/** Share sheet: Capacitor Share on native, navigator.share on web. */
import { Share } from '@capacitor/share';
import { isNativeApp } from '$lib/app/native';

export type SharePayload = {
	title?: string;
	text?: string;
	url?: string;
	files?: File[];
};

export async function shareContent(payload: SharePayload): Promise<boolean> {
	if (isNativeApp()) {
		try {
			await Share.share({
				title: payload.title,
				text: payload.text,
				url: payload.url,
				dialogTitle: payload.title
			});
			return true;
		} catch {
			return false;
		}
	}

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
	if (isNativeApp()) return true;
	return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}
