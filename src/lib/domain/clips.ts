export type TechniqueClip = {
	id: string;
	exerciseId: string;
	userId: string;
	title: string;
	authorLabel: string;
	gifPath: string;
	gifUrl: string;
	createdAt: string;
	hidden?: boolean;
	reportCount?: number;
};

/** Soft moderation knobs (enforced in DB too). */
export const CLIP_MODERATION = {
	maxPerDay: 5,
	reportsToHide: 3
} as const;

export const CLIP_TITLE_MAX = 80;
export const CLIP_AUTHOR_MAX = 32;
/** Reject absurd / bomb-ish logical sizes even if file is small. */
export const CLIP_GIF_MAX_EDGE = 1280;
export const CLIP_GIF_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Short RU/EN blocklist for clip titles. Intentionally small — not a full NSFW stack.
 * EN: token/prefix. RU: substring stems (inflection).
 */
const TITLE_PROFANITY_EN = [
	'fuck',
	'fucking',
	'shit',
	'bitch',
	'asshole',
	'cunt',
	'dick',
	'piss',
	'nigga',
	'nigger',
	'faggot',
	'slut',
	'whore'
] as const;

const TITLE_PROFANITY_RU = [
	'сука',
	'бляд',
	'блять',
	'хуй',
	'хуе',
	'хуё',
	'пизд',
	'ебан',
	'ёбан',
	'ебать',
	'мудак',
	'дроч'
] as const;

function normalizeTitleForScan(value: string): string {
	return value
		.toLowerCase()
		.replace(/[@$0]/g, (ch) => ({ '@': 'a', $: 's', '0': 'o' })[ch] ?? ch)
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function titleLooksProfane(raw: string): boolean {
	const scanned = normalizeTitleForScan(raw);
	if (!scanned) return false;
	const tokens = scanned.split(' ');
	if (
		TITLE_PROFANITY_EN.some((stem) =>
			tokens.some((t) => t === stem || t.startsWith(`${stem}ing`) || t.startsWith(stem))
		)
	) {
		return true;
	}
	return TITLE_PROFANITY_RU.some((stem) => scanned.includes(stem));
}

/** Strip controls / collapse spaces / hard cap — safe for display without {@html}. */
export function sanitizeClipTitle(raw: string, fallback = ''): string {
	const cleaned = raw
		.replace(/[\u0000-\u001F\u007F]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, CLIP_TITLE_MAX);
	return cleaned || fallback.slice(0, CLIP_TITLE_MAX);
}

/** Sanitize + reject empty / profane titles (publish & rename). */
export function assertCleanClipTitle(raw: string, fallback = ''): string {
	const cleaned = sanitizeClipTitle(raw, fallback);
	if (!cleaned) throw new Error('clips.titleRequired');
	if (titleLooksProfane(cleaned)) throw new Error('clips.titleProfane');
	return cleaned;
}

export function sanitizeAuthorLabel(raw: string): string {
	const cleaned = raw
		.replace(/[\u0000-\u001F\u007F]/g, '')
		.replace(/[^\p{L}\p{N}._-]+/gu, '')
		.slice(0, CLIP_AUTHOR_MAX);
	return cleaned || 'athlete';
}

/**
 * Verify GIF signature + size + logical screen bounds.
 * MIME / filename are not enough — call before upload.
 */
export async function assertValidGifBlob(
	blob: Blob,
	opts?: { maxBytes?: number; maxEdge?: number }
): Promise<void> {
	const maxBytes = opts?.maxBytes ?? CLIP_GIF_MAX_BYTES;
	const maxEdge = opts?.maxEdge ?? CLIP_GIF_MAX_EDGE;

	if (blob.size <= 0 || blob.size > maxBytes) {
		throw new Error('clips.tooBigGif');
	}

	const head = new Uint8Array(await blob.slice(0, 10).arrayBuffer());
	if (head.byteLength < 10) {
		throw new Error('clips.invalidGif');
	}

	const sig = String.fromCharCode(head[0]!, head[1]!, head[2]!, head[3]!, head[4]!, head[5]!);
	if (sig !== 'GIF87a' && sig !== 'GIF89a') {
		throw new Error('clips.invalidGif');
	}

	const width = head[6]! | (head[7]! << 8);
	const height = head[8]! | (head[9]! << 8);
	if (width < 1 || height < 1 || width > maxEdge || height > maxEdge) {
		throw new Error('clips.invalidGif');
	}
}
