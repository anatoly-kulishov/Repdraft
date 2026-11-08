import { randomUUID } from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import type { AiConfig } from './config';

export type ChatMessage = {
	role: 'system' | 'user' | 'assistant';
	content: string;
	/** GigaChat file ids from uploadFile (vision). */
	attachments?: string[];
};

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

type RequestBody = string | Buffer;

function bodyByteLength(body: RequestBody): number {
	return typeof body === 'string' ? Buffer.byteLength(body) : body.byteLength;
}

/** Scoped TLS bypass for GigaChat when GIGACHAT_SSL_VERIFY=false (no undici dep). */
function requestRaw(
	url: string,
	init: {
		method: string;
		headers: Record<string, string>;
		body?: RequestBody;
		sslVerify: boolean;
		timeoutMs?: number;
	}
): Promise<HttpResult> {
	const u = new URL(url);
	const isHttps = u.protocol === 'https:';
	const lib = isHttps ? https : http;
	const headers = { ...init.headers };
	const timeoutMs = init.timeoutMs ?? REQUEST_TIMEOUT_MS;
	if (init.body && !headers['Content-Length']) {
		headers['Content-Length'] = String(bodyByteLength(init.body));
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
		req.setTimeout(timeoutMs, () => {
			req.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
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
		body?: RequestBody;
		timeoutMs?: number;
	},
	sslVerify: boolean
): Promise<HttpResult> {
	const timeoutMs = init.timeoutMs ?? REQUEST_TIMEOUT_MS;
	if (sslVerify) {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), timeoutMs);
		try {
			const body =
				init.body == null
					? undefined
					: typeof init.body === 'string'
						? init.body
						: new Uint8Array(init.body);
			const res = await fetch(url, {
				method: init.method,
				headers: init.headers,
				body,
				signal: ctrl.signal
			});
			return { status: res.status, text: await res.text() };
		} finally {
			clearTimeout(timer);
		}
	}
	return requestRaw(url, { ...init, sslVerify: false, timeoutMs });
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
	init: {
		method: string;
		headers: Record<string, string>;
		body?: RequestBody;
		timeoutMs?: number;
	},
	sslVerify: boolean
): Promise<HttpResult> {
	try {
		const res = await aiFetch(url, init, sslVerify);
		if (isTransient(res.status)) {
			await new Promise((r) => setTimeout(r, 800));
			return aiFetch(url, init, sslVerify);
		}
		return res;
	} catch {
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

/** Authenticated JSON POST to `{baseUrl}{path}` (chat, embeddings, …). */
export async function authenticatedJsonPost(
	cfg: AiConfig,
	path: string,
	payload: unknown
): Promise<HttpResult> {
	const sslVerify = cfg.provider === 'gigachat' ? cfg.sslVerify : true;
	const body = JSON.stringify(payload);
	const url = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

	const run = async (forceRefresh: boolean) => {
		const token = await bearer(cfg, forceRefresh);
		return aiFetchWithRetry(
			url,
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
	return res;
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

	const res = await authenticatedJsonPost(cfg, '/chat/completions', payload);
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

const FILE_UPLOAD_TIMEOUT_MS = 60_000;

/**
 * Upload a file to GigaChat storage (`POST /files`, purpose=general).
 * Returns the file id for `attachments` on chat messages.
 */
export async function uploadFile(
	cfg: AiConfig,
	bytes: Buffer,
	filename: string,
	contentType: string
): Promise<string> {
	if (cfg.provider !== 'gigachat') {
		throw new Error('File upload is only supported for GigaChat');
	}
	const boundary = `----Repdraft${randomUUID().replace(/-/g, '')}`;
	const head = Buffer.from(
		[
			`--${boundary}`,
			`Content-Disposition: form-data; name="purpose"`,
			'',
			'general',
			`--${boundary}`,
			`Content-Disposition: form-data; name="file"; filename="${filename.replace(/"/g, '')}"`,
			`Content-Type: ${contentType}`,
			'',
			''
		].join('\r\n'),
		'utf8'
	);
	const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
	const body = Buffer.concat([head, bytes, tail]);
	const url = `${cfg.baseUrl}/files`;
	const sslVerify = cfg.sslVerify;

	const run = async (forceRefresh: boolean) => {
		const token = await bearer(cfg, forceRefresh);
		return aiFetchWithRetry(
			url,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: 'application/json',
					'Content-Type': `multipart/form-data; boundary=${boundary}`
				},
				body,
				timeoutMs: FILE_UPLOAD_TIMEOUT_MS
			},
			sslVerify
		);
	};

	let res = await run(false);
	if (isExpiredTokenError(res.status, res.text)) {
		cachedToken = null;
		res = await run(true);
	}
	if (res.status < 200 || res.status >= 300) {
		throw new Error(`GigaChat file upload failed (${extractUpstreamMessage(res.status, res.text)})`);
	}
	const json = JSON.parse(res.text) as { id?: string };
	if (!json.id || typeof json.id !== 'string') {
		throw new Error(`GigaChat file upload: no id in ${res.text.slice(0, 200)}`);
	}
	return json.id;
}

/** Best-effort delete of a GigaChat storage file (privacy). */
export async function deleteFile(cfg: AiConfig, fileId: string): Promise<void> {
	if (cfg.provider !== 'gigachat' || !fileId.trim()) return;
	const url = `${cfg.baseUrl}/files/${encodeURIComponent(fileId.trim())}`;
	try {
		const token = await bearer(cfg, false);
		await aiFetch(
			url,
			{
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: 'application/json'
				}
			},
			cfg.sslVerify
		);
	} catch {
		/* ignore */
	}
}
