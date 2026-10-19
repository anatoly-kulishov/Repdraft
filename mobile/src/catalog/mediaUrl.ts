/** Resolve catalog image paths against the public web origin (GIFs/JPGs stay on web CDN). */
const DEFAULT_ORIGIN = 'https://www.repdraft.xyz';

function isDevHost(): boolean {
	if (typeof process === 'undefined') return false;
	const env = process.env.EXPO_PUBLIC_WEB_ORIGIN;
	if (!env) return false;
	return env.includes('://localhost') || env.includes('://127.0.0.1');
}

function devLocalhost(): string {
	// Metro strips localhost URLs on iOS simulator: the simulator's loopback
	// is not the host Mac. In dev, fall back to the production origin so
	// media still resolves. Override EXPO_PUBLIC_WEB_ORIGIN with your LAN IP
	// to hit a local Vite server from a device/simulator.
	return DEFAULT_ORIGIN;
}

export function webOrigin(): string {
	const fromEnv =
		typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_WEB_ORIGIN
			? String(process.env.EXPO_PUBLIC_WEB_ORIGIN).trim()
			: '';
	if (!fromEnv) return DEFAULT_ORIGIN;
	if (isDevHost()) return devLocalhost();
	return fromEnv.replace(/\/$/, '');
}

/** Media (images/GIFs) origin. In dev we always hit production so a local Vite server is not required. */
export function mediaOrigin(): string {
	if (__DEV__) return DEFAULT_ORIGIN;
	return webOrigin();
}

export function catalogMediaUrl(imagePath: string | null | undefined): string | null {
	if (!imagePath || typeof imagePath !== 'string') return null;
	if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
	const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
	return `${mediaOrigin()}${path}`;
}

export function articleMediaUrl(src: string | null | undefined): string | null {
	if (!src || typeof src !== 'string') return null;
	if (src.startsWith('http://') || src.startsWith('https://')) return src;
	const path = src.startsWith('/') ? src : `/${src}`;
	return `${mediaOrigin()}${path}`;
}

export function aiPlanEndpoint(): string {
	return `${webOrigin()}/api/ai/plan`;
}
