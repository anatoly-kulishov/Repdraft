import type { RecognizedProgram } from '$lib/domain/recognizeProgram';
import { accountCorsHeaders, requireUser } from '$lib/server/auth/requireUser';
import {
	consumeAiRecognizeQuota,
	peekAiRecognizeQuota,
	refundAiRecognizeQuota,
	type AiQuotaStatus
} from '$lib/server/ai/aiDailyQuota';
import { aiVisionAvailability } from '$lib/server/ai/config';
import { recognizeProgramFromImage } from '$lib/server/ai/visionProgram';
import { userHasPro } from '$lib/server/billing/requirePro';
import {
	recognizedProgramFromCsv,
	recognizedProgramFromXlsx
} from '$lib/server/import/xlsxRows';
import type { RequestHandler } from './$types';

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const TABLE_MAX_BYTES = 2 * 1024 * 1024;

const IMAGE_MIME = new Set([
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/webp',
	'image/heic',
	'image/heif',
	'image/gif'
]);

function corsHeaders(request: Request): HeadersInit {
	return accountCorsHeaders(request, 'GET, POST, OPTIONS');
}

function jsonWithCors(request: Request, body: unknown, init?: ResponseInit) {
	const headers = new Headers(init?.headers);
	const cors = corsHeaders(request);
	for (const [k, v] of Object.entries(cors)) headers.set(k, v);
	if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
	return new Response(JSON.stringify(body), { ...init, headers });
}

export const OPTIONS: RequestHandler = async ({ request }) =>
	new Response(null, { status: 204, headers: corsHeaders(request) });

/** Recognize quota is per account: the route already required a bearer token. */
function recognizeKey(userId: string): string {
	return `u:${userId}`;
}

function extOf(name: string): string {
	const i = name.lastIndexOf('.');
	return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function isImageFile(file: File): boolean {
	const mime = (file.type || '').toLowerCase();
	if (IMAGE_MIME.has(mime)) return true;
	const ext = extOf(file.name);
	return ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'].includes(ext);
}

function isTableFile(file: File): boolean {
	const mime = (file.type || '').toLowerCase();
	if (
		mime.includes('sheet') ||
		mime.includes('excel') ||
		mime === 'text/csv' ||
		mime === 'application/csv' ||
		mime === 'text/plain'
	) {
		return true;
	}
	const ext = extOf(file.name);
	return ['xlsx', 'xls', 'csv'].includes(ext);
}

export const GET: RequestHandler = async ({ request }) => {
	const vision = aiVisionAvailability();
	const gate = await requireUser(request);
	const pro = gate.ok ? await userHasPro(gate.admin, gate.user) : false;
	/* Photo recognition is capped per user; Excel/CSV stays unlimited. */
	const quota = gate.ok ? peekAiRecognizeQuota(recognizeKey(gate.user.id)) : null;
	return jsonWithCors(
		request,
		{
			available: vision.available,
			provider: vision.provider,
			reason: vision.reason,
			pro,
			tableParse: true,
			...(quota ? { recognizeLimit: quota.limit, recognizeRemaining: quota.remaining } : {})
		},
		{ status: 200 }
	);
};

export const POST: RequestHandler = async ({ request }) => {
	const gate = await requireUser(request);
	if (!gate.ok) {
		const code = gate.status === 401 ? 'needAuth' : 'unavailable';
		return jsonWithCors(
			request,
			{ ok: false, code, error: gate.errorKey },
			{ status: gate.status }
		);
	}

	const pro = await userHasPro(gate.admin, gate.user);
	if (!pro) {
		return jsonWithCors(
			request,
			{ ok: false, code: 'needPro', error: 'recognize.needPro' },
			{ status: 403 }
		);
	}

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return jsonWithCors(
			request,
			{ ok: false, code: 'invalid_file', error: 'Invalid multipart body' },
			{ status: 400 }
		);
	}

	const entry = form.get('file');
	if (!(entry instanceof File) || entry.size <= 0) {
		return jsonWithCors(
			request,
			{ ok: false, code: 'invalid_file', error: 'Missing file' },
			{ status: 400 }
		);
	}

	const image = isImageFile(entry);
	const table = isTableFile(entry);
	if (!image && !table) {
		return jsonWithCors(
			request,
			{ ok: false, code: 'invalid_file', error: 'Unsupported file type' },
			{ status: 400 }
		);
	}

	const maxBytes = image ? IMAGE_MAX_BYTES : TABLE_MAX_BYTES;
	if (entry.size > maxBytes) {
		return jsonWithCors(
			request,
			{ ok: false, code: 'too_large', error: 'File too large' },
			{ status: 413 }
		);
	}

	const bytes = Buffer.from(await entry.arrayBuffer());
	const filename = entry.name || (image ? 'program.jpg' : 'program.xlsx');
	let program: RecognizedProgram | null = null;
	let recognizeQuota: AiQuotaStatus | null = null;

	if (image) {
		const vision = aiVisionAvailability();
		if (!vision.available) {
			return jsonWithCors(
				request,
				{ ok: false, code: 'unavailable', error: vision.reason ?? 'Vision unavailable' },
				{ status: 503 }
			);
		}
		/* The vision model is the expensive path: a photo costs a call, a
		   spreadsheet is parsed locally for free. */
		const quotaKey = recognizeKey(gate.user.id);
		const quota = consumeAiRecognizeQuota(quotaKey);
		if (!quota.ok) {
			return jsonWithCors(
				request,
				{
					ok: false,
					code: 'rate_limit',
					error: 'recognize.quota',
					limit: quota.limit,
					remaining: 0
				},
				{ status: 429 }
			);
		}
		recognizeQuota = quota;
		const contentType = entry.type || 'image/jpeg';
		const result = await recognizeProgramFromImage(bytes, filename, contentType);
		if (!result.ok) {
			/* Never asked the model: give the call back, like the text routes. */
			if (result.code === 'unavailable') {
				refundAiRecognizeQuota(quotaKey);
				recognizeQuota = null;
			}
			const status =
				result.code === 'unavailable' ? 503 : result.code === 'no_program' ? 422 : 502;
			return jsonWithCors(
				request,
				{ ok: false, code: result.code, error: result.error },
				{ status }
			);
		}
		program = result.program;
	} else {
		const ext = extOf(filename);
		if (ext === 'csv' || (entry.type || '').includes('csv') || (entry.type || '') === 'text/plain') {
			program = recognizedProgramFromCsv(bytes.toString('utf8'), filename.replace(/\.[^.]+$/, ''));
		} else if (ext === 'xls') {
			// exceljs reads .xlsx only; old binary .xls needs a different parser.
			return jsonWithCors(
				request,
				{
					ok: false,
					code: 'invalid_file',
					error: 'Save as .xlsx or CSV and try again'
				},
				{ status: 400 }
			);
		} else {
			try {
				program = await recognizedProgramFromXlsx(bytes, filename.replace(/\.[^.]+$/, ''));
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return jsonWithCors(
					request,
					{ ok: false, code: 'invalid_file', error: msg.slice(0, 200) },
					{ status: 400 }
				);
			}
		}
		if (!program) {
			return jsonWithCors(
				request,
				{ ok: false, code: 'no_program', error: 'No program rows found' },
				{ status: 422 }
			);
		}
	}

	return jsonWithCors(request, {
		ok: true,
		program,
		...(recognizeQuota
			? { recognizeLimit: recognizeQuota.limit, recognizeRemaining: recognizeQuota.remaining }
			: {})
	});
};
