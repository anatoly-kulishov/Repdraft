/** Local device preferences (not synced to cloud). */

export const REST_SOUND_STORAGE_KEY = 'repdraft:rest-sound';
export const INSTALL_HINT_DISMISSED_KEY = 'repdraft:install-hint-dismissed';
export const PWA_INSTALLED_KEY = 'repdraft:pwa-installed';

export function parseRestSoundEnabled(raw: string | null | undefined): boolean {
	if (raw === '0' || raw === 'false') return false;
	return true;
}

export function isInstallHintDismissed(): boolean {
	if (typeof localStorage === 'undefined') return true;
	return localStorage.getItem(INSTALL_HINT_DISMISSED_KEY) === '1';
}

export function dismissInstallHint(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(INSTALL_HINT_DISMISSED_KEY, '1');
}

export function isPwaInstalledPref(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(PWA_INSTALLED_KEY) === '1';
}

export function markPwaInstalled(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(PWA_INSTALLED_KEY, '1');
}

export function clearPwaInstalledPref(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(PWA_INSTALLED_KEY);
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
	if (typeof window === 'undefined') return null;
	return (
		window.AudioContext ||
		(window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ||
		null
	);
}

/** One shared context — must be resumed from a user gesture before timer chimes work. */
let sharedCtx: AudioContext | null = null;

function getSharedContext(): AudioContext | null {
	const AC = getAudioContextCtor();
	if (!AC) return null;
	if (!sharedCtx || sharedCtx.state === 'closed') {
		sharedCtx = new AC();
	}
	return sharedCtx;
}

async function ensureRunning(ctx: AudioContext): Promise<boolean> {
	try {
		if (ctx.state !== 'running') await ctx.resume();
		return ctx.state === 'running';
	} catch {
		return false;
	}
}

function beep(ctx: AudioContext, at: number, freq: number, dur: number, peak = 0.35): void {
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(0.0001, at);
	gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
	gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
	gain.connect(ctx.destination);

	const osc = ctx.createOscillator();
	osc.type = 'square';
	osc.frequency.setValueAtTime(freq, at);
	osc.connect(gain);
	osc.start(at);
	osc.stop(at + dur + 0.02);
}

/** Short gym-friendly chime via Web Audio (no asset). */
export function playRestDoneChime(): void {
	const ctx = getSharedContext();
	if (!ctx) return;
	void ensureRunning(ctx).then((ok) => {
		if (!ok) return;
		try {
			const t = ctx.currentTime + 0.02;
			// Two punches — easier to hear on phone speakers than a soft sine.
			beep(ctx, t, 880, 0.12, 0.4);
			beep(ctx, t + 0.16, 1175, 0.18, 0.45);
		} catch {
			/* ignore */
		}
	});
}

/** Haptic pulse when rest ends (no-op if unsupported / denied). */
export function vibrateRestDone(): void {
	if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
	try {
		navigator.vibrate([40, 60, 40]);
	} catch {
		/* ignore */
	}
}

export function signalRestDone(): void {
	vibrateRestDone();
	playRestDoneChime();
}

/** Call from a user gesture so later timer chimes can resume AudioContext. */
export function unlockAudioFromGesture(): void {
	const ctx = getSharedContext();
	if (!ctx) return;
	void ensureRunning(ctx);
}
