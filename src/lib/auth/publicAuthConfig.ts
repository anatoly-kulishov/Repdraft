/** Public auth feature flags (browser-safe). */

export function turnstileSiteKey(): string {
	return (import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? '';
}

export function isTurnstileConfigured(): boolean {
	return turnstileSiteKey().length > 0;
}
