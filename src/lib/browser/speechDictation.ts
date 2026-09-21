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

export type MicPermission = 'granted' | 'denied' | 'unsupported' | 'unavailable' | 'aborted';

function getCtor(): SpeechRecognitionCtor | null {
	if (typeof window === 'undefined') return null;
	const w = window as Window & {
		SpeechRecognition?: SpeechRecognitionCtor;
		webkitSpeechRecognition?: SpeechRecognitionCtor;
	};
	return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function hasGetUserMedia(): boolean {
	return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function speechDictationSupported(): boolean {
	if (typeof window === 'undefined') return false;
	// Mic / SpeechRecognition need a secure context (https or localhost).
	if (!window.isSecureContext) return false;
	if (!hasGetUserMedia()) return false;
	return getCtor() !== null;
}

export function speechDictationBlockReason(): 'insecure' | 'unsupported' | null {
	if (typeof window === 'undefined') return 'unsupported';
	if (!window.isSecureContext) return 'insecure';
	if (!hasGetUserMedia() || !getCtor()) return 'unsupported';
	return null;
}

export function speechLangFromLocale(locale: AppLocale): string {
	return locale === 'ru' ? 'ru-RU' : 'en-US';
}

export type DictationSession = {
	stop: () => void;
};

/**
 * Triggers the browser mic permission prompt, then releases the stream.
 * SpeechRecognition alone often fails with not-allowed without a dialog.
 */
export async function ensureMicrophonePermission(): Promise<MicPermission> {
	if (!hasGetUserMedia()) {
		return 'unsupported';
	}

	try {
		const perms = navigator.permissions;
		if (perms?.query) {
			try {
				const status = await perms.query({ name: 'microphone' as PermissionName });
				if (status.state === 'denied') return 'denied';
				/* 'granted' / 'prompt' → still call getUserMedia (stale grant / show dialog). */
			} catch {
				/* Safari / some Chromium builds reject microphone PermissionName */
			}
		}

		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		for (const track of stream.getTracks()) track.stop();
		return 'granted';
	} catch (err) {
		const name = err instanceof DOMException ? err.name : '';
		if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
			return 'denied';
		}
		if (name === 'AbortError') {
			return 'aborted';
		}
		if (
			name === 'SecurityError' ||
			name === 'NotFoundError' ||
			name === 'DevicesNotFoundError' ||
			name === 'NotReadableError' ||
			name === 'TrackStartError' ||
			name === 'OverconstrainedError'
		) {
			return 'unavailable';
		}
		return 'unavailable';
	}
}

function permToError(perm: MicPermission): string {
	switch (perm) {
		case 'unsupported':
			return 'unsupported';
		case 'denied':
			return 'not-allowed';
		case 'unavailable':
			return 'unavailable';
		case 'aborted':
			return 'aborted';
		case 'granted':
			return 'unknown';
		default: {
			const _exhaustive: never = perm;
			return _exhaustive;
		}
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
	if (typeof window === 'undefined' || !window.isSecureContext) {
		opts.onError?.('insecure');
		opts.onEnd?.();
		return null;
	}

	const lang = opts.lang.trim();
	if (!lang) {
		opts.onError?.('unsupported');
		opts.onEnd?.();
		return null;
	}

	const Ctor = getCtor();
	if (!Ctor || !hasGetUserMedia()) {
		opts.onError?.('unsupported');
		opts.onEnd?.();
		return null;
	}

	const perm = await ensureMicrophonePermission();
	if (perm !== 'granted') {
		opts.onError?.(permToError(perm));
		opts.onEnd?.();
		return null;
	}

	const rec = new Ctor();
	rec.lang = lang;
	rec.continuous = false;
	rec.interimResults = true;

	let lastFinal = '';
	let lastInterim = '';
	let finished = false;

	const finish = () => {
		if (finished) return;
		finished = true;
		opts.onEnd?.();
	};

	const promoteInterimIfNeeded = () => {
		if (finished) return;
		const text = lastInterim.trim();
		if (!text || lastFinal) return;
		lastFinal = text;
		opts.onFinal(text);
	};

	rec.onresult = (ev) => {
		if (finished) return;
		let interim = '';
		let finalText = '';
		for (let i = ev.resultIndex; i < ev.results.length; i++) {
			const row = ev.results[i];
			const piece = row?.[0]?.transcript ?? '';
			if (row?.isFinal) finalText += piece;
			else interim += piece;
		}
		const trimmedFinal = finalText.trim();
		/* One-shot: at most one onFinal (continuous=false). */
		if (trimmedFinal && !lastFinal) {
			lastFinal = trimmedFinal;
			lastInterim = '';
			opts.onFinal(trimmedFinal);
		} else if (!lastFinal && interim.trim()) {
			lastInterim = interim.trim();
			opts.onInterim?.(lastInterim);
		}
	};

	rec.onerror = (ev) => {
		if (finished) return;
		opts.onError?.(ev.error || 'unknown');
		/* Engines sometimes omit onend after error — always close lifecycle. */
		finish();
	};

	rec.onend = () => {
		if (finished) return;
		promoteInterimIfNeeded();
		finish();
	};

	try {
		rec.start();
	} catch {
		opts.onError?.('start_failed');
		finish();
		return null;
	}

	return {
		stop: () => {
			promoteInterimIfNeeded();
			try {
				rec.stop();
			} catch {
				try {
					rec.abort();
				} catch {
					/* ignore */
				}
			}
			/* stop() may sync-fire onend → finish(); if not, finish here once. */
			finish();
		}
	};
}
