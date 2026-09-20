/** Share sheet via navigator.share. */

export type SharePayload = {
	title?: string;
	text?: string;
	url?: string;
	files?: File[];
};

export async function shareContent(payload: SharePayload): Promise<boolean> {
	if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
		return false;
	}
	try {
		await navigator.share({
			title: payload.title,
			text: payload.text,
			url: payload.url,
			files: payload.files
		});
		return true;
	} catch {
		return false;
	}
}

export function canShare(): boolean {
	return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}
