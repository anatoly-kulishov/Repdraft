import { randomUUID } from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import type { AiConfig } from './config';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type FunctionDef = {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
};

export type ChatResult = {
	content: string | null;
	functionArguments: string | null;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

type HttpResult = { status: number; text: string };

const REQUEST_TIMEOUT_MS = 30_000;

/** Scoped TLS bypass for GigaChat when GIGACHAT_SSL_VERIFY=false (no undici dep). */
function requestRaw(
	url: string,
	init: {
		method: string;
		headers: Record<string, string>;
		body?: string;
		sslVerify: boolean;
	}
): Promise<HttpResult> {
	const u = new URL(url);
	const isHttps = u.protocol === 'https:';
	const lib = isHttps ? https : http;
	const headers = { ...init.headers };
	if (init.body && !headers['Content-Length']) {
		headers['Content-Length'] = String(Buffer.byteLength(init.body));
	}

	return new Promise((resolve, reject) => {
		const req = lib.request(
			{
				protocol: u.protocol,
				hostname: u.hostname,
				port: u.port || (isHttps ? 443 : 80),
				path: `${u.pathname}${u.search}`,
				method: init.method,
				headers,
				...(isHttps ? { rejectUnauthorized: init.sslVerify } : {})
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (c) => chunks.push(c));
				res.on('end', () => {
					resolve({
						status: res.statusCode ?? 0,
						text: Buffer.concat(chunks).toString('utf8')
					});
				});
			}
		);
		req.on('error', reject);
		req.setTimeout(REQUEST_TIMEOUT_MS, () => {
			req.destroy(new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`));
		});
		if (init.body) req.write(init.body);
		req.end();
	});
}

async function aiFetch(
	url: string,
	init: {
		method: string;
		headers: Record<string, string>;
		body?: string;
	},
	sslVerify: boolean
): Promise<HttpResult> {
	if (sslVerify) {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
		try {
			const res = await fetch(url, {
				method: init.method,
				headers: init.headers,
				body: init.body,
				signal: ctrl.signal
			});
			return { status: res.status, text: await res.text() };
		} finally {
			clearTimeout(timer);
		}
	}
	return requestRaw(url, { ...init, sslVerify: false });
}

/** Extract human-readable error from LLM response body. */
function extractUpstreamMessage(status: number, body: string): string {
	try {
		const data = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
		const msg =
			typeof data.error === 'string' ? data.error : data.error?.message ?? data.message ?? '';
		if (msg) return `${status}: ${msg.slice(0, 200)}`;
	} catch {
		/* not JSON */
	}
	return `${status}: ${body.slice(0, 200)}`;
}

function isTransient(status: number): boolean {
	return status === 429 || status >= 500;
}

/** One retry on transient upstream / network errors. */
async function aiFetchWithRetry(
	url: string,
	init: { method: string; headers: Record<string, string>; body?: string },
	sslVerify: boolean
): Promise<HttpResult> {
	try {
		const res = await aiFetch(url, init, sslVerify);
		if (isTransient(res.status)) {
			await new Promise((r) => setTimeout(r, 800));
			return aiFetch(url, init, sslVerify);
		}
		return res;
	} catch (err) {
		await new Promise((r) => setTimeout(r, 800));
		return aiFetch(url, init, sslVerify);
	}
}

async function gigachatAccessToken(cfg: AiConfig, forceRefresh = false): Promise<string> {
	const now = Date.now();
	if (!forceRefresh && cachedToken && cachedToken.expiresAt > now + 30_000) {
		return cachedToken.value;
	}

	const body = new URLSearchParams({ scope: cfg.scope }).toString();
	const res = await aiFetchWithRetry(
		cfg.oauthUrl,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json',
				RqUID: randomUUID(),
				Authorization: `Basic ${cfg.apiKey}`
			},
			body
		},
		cfg.sslVerify
	);

	if (res.status < 200 || res.status >= 300) {
		throw new Error(`GigaChat OAuth failed (${res.status}): ${res.text.slice(0, 400)}`);
	}
	const json = JSON.parse(res.text) as { access_token?: string; expires_at?: number };
	if (!json.access_token) {
		throw new Error(`GigaChat OAuth: no access_token in ${res.text.slice(0, 400)}`);
	}
	// GigaChat may return expires_at as unix seconds or ms — normalize to ms.
	let expiresAt = now + 25 * 60_000;
	if (typeof json.expires_at === 'number' && Number.isFinite(json.expires_at)) {
		expiresAt = json.expires_at > 1e12 ? json.expires_at : json.expires_at * 1000;
	}
	cachedToken = {
		value: json.access_token,
		expiresAt
	};
	return json.access_token;
}

async function bearer(cfg: AiConfig, forceRefresh = false): Promise<string> {
	if (cfg.provider === 'gigachat') return gigachatAccessToken(cfg, forceRefresh);
	return cfg.apiKey;
}

function isExpiredTokenError(status: number, body: string): boolean {
	if (status !== 401) return false;
	return /expired|invalid.?token|unauthorized/i.test(body);
}

export async function chatCompletion(
	cfg: AiConfig,
	opts: {
		messages: ChatMessage[];
		temperature?: number;
		functions?: FunctionDef[];
		functionCall?: { name: string };
		jsonObject?: boolean;
	}
): Promise<ChatResult> {
	const payload: Record<string, unknown> = {
		model: cfg.model,
		messages: opts.messages,
		temperature: opts.temperature ?? 0.2
	};
	if (opts.functions?.length) {
		payload.functions = opts.functions;
		if (opts.functionCall) payload.function_call = opts.functionCall;
	} else if (opts.jsonObject && cfg.provider === 'ollama') {
		payload.response_format = { type: 'json_object' };
	}

	const sslVerify = cfg.provider === 'gigachat' ? cfg.sslVerify : true;
	const body = JSON.stringify(payload);

	const run = async (forceRefresh: boolean) => {
		const token = await bearer(cfg, forceRefresh);
		return aiFetchWithRetry(
			`${cfg.baseUrl}/chat/completions`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
					Accept: 'application/json'
				},
				body
			},
			sslVerify
		);
	};

	let res = await run(false);
	if (cfg.provider === 'gigachat' && isExpiredTokenError(res.status, res.text)) {
		cachedToken = null;
		res = await run(true);
	}

	if (res.status < 200 || res.status >= 300) {
		throw new Error(`LLM chat failed (${extractUpstreamMessage(res.status, res.text)})`);
	}

	const data = JSON.parse(res.text) as {
		choices?: Array<{
			message?: {
				content?: string | null;
				function_call?: { name?: string; arguments?: string };
			};
		}>;
	};
	const msg = data.choices?.[0]?.message;
	const fnArgs = msg?.function_call?.arguments ?? null;
	return {
		content: msg?.content ?? null,
		functionArguments: typeof fnArgs === 'string' ? fnArgs : fnArgs ? JSON.stringify(fnArgs) : null
	};
}
