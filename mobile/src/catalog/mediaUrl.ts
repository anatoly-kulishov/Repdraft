/** Resolve catalog image paths against the public web origin (GIFs/JPGs stay on web CDN). */
const DEFAULT_ORIGIN = 'https://www.repdraft.xyz';

export function webOrigin(): string {
	const fromEnv =
		typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_WEB_ORIGIN
			? String(process.env.EXPO_PUBLIC_WEB_ORIGIN).trim()
			: '';
	return (fromEnv || DEFAULT_ORIGIN).replace(/\/$/, '');
}

export function catalogMediaUrl(imagePath: string | null | undefined): string | null {
	if (!imagePath || typeof imagePath !== 'string') return null;
	if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
	const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
	return `${webOrigin()}${path}`;
}

export function aiPlanEndpoint(): string {
	return `${webOrigin()}/api/ai/plan`;
}
