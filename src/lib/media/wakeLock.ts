/** Screen Wake Lock while an active live workout is on screen (best-effort). */
import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNativeApp } from '$lib/app/native';

type WakeLockSentinelLike = {
	released: boolean;
	release: () => Promise<void>;
	addEventListener?: (type: 'release', listener: () => void) => void;
};

let sentinel: WakeLockSentinelLike | null = null;
let visibleHandler: (() => void) | null = null;
let nativeKept = false;

async function requestNativeKeepAwake(): Promise<void> {
	try {
		await KeepAwake.keepAwake();
		nativeKept = true;
	} catch {
		nativeKept = false;
	}
}

async function releaseNativeKeepAwake(): Promise<void> {
	if (!nativeKept) return;
	try {
		await KeepAwake.allowSleep();
	} catch {
		/* ignore */
	}
	nativeKept = false;
}

async function requestWebLock(): Promise<void> {
	if (typeof navigator === 'undefined') return;
	const nav = navigator as Navigator & {
		wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
	};
	if (!nav.wakeLock) return;
	try {
		const next = await nav.wakeLock.request('screen');
		sentinel = next;
		next.addEventListener?.('release', () => {
			if (sentinel === next) sentinel = null;
		});
	} catch {
		sentinel = null;
	}
}

async function requestLock(): Promise<void> {
	if (isNativeApp()) {
		await requestNativeKeepAwake();
		return;
	}
	await requestWebLock();
}

export async function acquireScreenWakeLock(): Promise<void> {
	await requestLock();
	if (typeof document === 'undefined' || visibleHandler) return;
	visibleHandler = () => {
		if (document.visibilityState === 'visible') void requestLock();
	};
	document.addEventListener('visibilitychange', visibleHandler);
	window.addEventListener('pageshow', visibleHandler);
	window.addEventListener('focus', visibleHandler);
}

export async function releaseScreenWakeLock(): Promise<void> {
	if (visibleHandler && typeof document !== 'undefined') {
		document.removeEventListener('visibilitychange', visibleHandler);
		window.removeEventListener('pageshow', visibleHandler);
		window.removeEventListener('focus', visibleHandler);
		visibleHandler = null;
	}
	if (isNativeApp()) {
		await releaseNativeKeepAwake();
		return;
	}
	const current = sentinel;
	sentinel = null;
	if (current && !current.released) {
		try {
			await current.release();
		} catch {
			/* ignore */
		}
	}
}
