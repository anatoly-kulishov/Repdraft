/** Screen Wake Lock while an active live workout is on screen (best-effort). */

type WakeLockSentinelLike = {
	released: boolean;
	release: () => Promise<void>;
	addEventListener?: (type: 'release', listener: () => void) => void;
};

let sentinel: WakeLockSentinelLike | null = null;
let visibleHandler: (() => void) | null = null;

async function requestLock(): Promise<void> {
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

export async function acquireScreenWakeLock(): Promise<void> {
	await requestLock();
	if (typeof document === 'undefined' || visibleHandler) return;
	visibleHandler = () => {
		if (document.visibilityState === 'visible') void requestLock();
	};
	document.addEventListener('visibilitychange', visibleHandler);
}

export async function releaseScreenWakeLock(): Promise<void> {
	if (visibleHandler && typeof document !== 'undefined') {
		document.removeEventListener('visibilitychange', visibleHandler);
		visibleHandler = null;
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
