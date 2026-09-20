import type { AppLocale } from '$lib/i18n/locale';

/** Minimal Web Speech API surface (Chrome / Safari). */
type SpeechRecognitionResultLike = {
	readonly isFinal: boolean;
	readonly 0?: { transcript?: string };
};

type SpeechRecognitionEventLike = {
	readonly resultIndex: number;
	readonly results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = {
	readonly error: string;
};

type SpeechRecognitionLike = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
	onerror: ((ev: SpeechRecognitionErrorLike) => void) | null;
	onend: (() => void) | null;
	start: () => void;
	stop: () => void;
	abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
	if (typeof window === 'undefined') return null;
	const w = window as Window & {
		SpeechRecognition?: SpeechRecognitionCtor;
		webkitSpeechRecognition?: SpeechRecognitionCtor;
	};
	return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechDictationSupported(): boolean {
	if (typeof window === 'undefined') return false;
	// Mic / SpeechRecognition need a secure context (https or localhost).
	// Opening via http://192.168.x.x on a phone usually fails this check.
	if (!window.isSecureContext) return false;
	return getCtor() !== null;
}

export function speechDictationBlockReason(): 'insecure' | 'unsupported' | null {
	if (typeof window === 'undefined') return 'unsupported';
	if (!window.isSecureContext) return 'insecure';
	if (!getCtor()) return 'unsupported';
	return null;
}

export function speechLangFromLocale(locale: AppLocale): string {
	return locale === 'en' ? 'en-US' : 'ru-RU';
}

export type DictationSession = {
	stop: () => void;
};

/**
 * Triggers the browser mic permission prompt, then releases the stream.
 * SpeechRecognition alone often fails with not-allowed without a dialog.
 */
export async function ensureMicrophonePermission(): Promise<'granted' | 'denied' | 'unsupported'> {
	if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
		return 'unsupported';
	}

	try {
		const perms = navigator.permissions;
		if (perms?.query) {
			try {
				const status = await perms.query({ name: 'microphone' as PermissionName });
				if (status.state === 'granted') return 'granted';
				if (status.state === 'denied') return 'denied';
				// 'prompt' → fall through to getUserMedia to show the dialog
			} catch {
				/* Safari / some Chromium builds reject microphone PermissionName */
			}
		}

		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		for (const track of stream.getTracks()) track.stop();
		return 'granted';
	} catch (err) {
		const name = err instanceof DOMException ? err.name : '';
		if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
			return 'denied';
		}
		return 'denied';
	}
}

/** One-shot utterance → onFinal. Requests mic permission first so the browser shows its dialog. */
export async function startSpeechDictation(opts: {
	lang: string;
	onFinal: (text: string) => void;
	onInterim?: (text: string) => void;
	onError?: (code: string) => void;
	onEnd?: () => void;
}): Promise<DictationSession | null> {
	const Ctor = getCtor();
	if (!Ctor) {
		opts.onError?.('unsupported');
		return null;
	}

	const perm = await ensureMicrophonePermission();
	if (perm !== 'granted') {
		opts.onError?.(perm === 'unsupported' ? 'unsupported' : 'not-allowed');
		return null;
	}

	const rec = new Ctor();
	rec.lang = opts.lang;
	rec.continuous = false;
	rec.interimResults = true;

	let lastFinal = '';
	let stopped = false;

	rec.onresult = (ev) => {
		let interim = '';
		let finalText = '';
		for (let i = ev.resultIndex; i < ev.results.length; i++) {
			const row = ev.results[i];
			const piece = row?.[0]?.transcript ?? '';
			if (row?.isFinal) finalText += piece;
			else interim += piece;
		}
		const trimmedFinal = finalText.trim();
		if (trimmedFinal && trimmedFinal !== lastFinal) {
			lastFinal = trimmedFinal;
			opts.onFinal(trimmedFinal);
		} else if (interim.trim() && opts.onInterim) {
			opts.onInterim(interim.trim());
		}
	};

	rec.onerror = (ev) => {
		opts.onError?.(ev.error || 'unknown');
	};

	rec.onend = () => {
		if (!stopped) opts.onEnd?.();
	};

	try {
		rec.start();
	} catch {
		opts.onError?.('start_failed');
		return null;
	}

	return {
		stop: () => {
			stopped = true;
			try {
				rec.stop();
			} catch {
				try {
					rec.abort();
				} catch {
					/* ignore */
				}
			}
			opts.onEnd?.();
		}
	};
}
