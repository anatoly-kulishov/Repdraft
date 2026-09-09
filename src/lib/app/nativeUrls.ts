/**
 * Pure URL helpers for Capacitor / web dual delivery.
 * Keep free of Capacitor, DOM, and $app so Node selfchecks can run them.
 */

/** Absolute origin for web-only APIs when the UI runs in a static native shell. */
export function resolveWebApiOrigin(opts: {
	webOrigin?: string | null;
	siteUrl?: string | null;
	browserOrigin?: string | null;
}): string {
	const fromEnv = (opts.webOrigin ?? opts.siteUrl ?? '').trim().replace(/\/$/, '');
	if (fromEnv.startsWith('https://') || fromEnv.startsWith('http://')) return fromEnv;
	return (opts.browserOrigin ?? '').trim().replace(/\/$/, '');
}

/** Whether a deep-link / open-URL should hydrate Supabase auth. */
export function isAuthDeepLinkUrl(raw: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return false;
	}

	const isAuthScheme =
		parsed.protocol === 'repdraft:' &&
		(parsed.hostname === 'auth' || parsed.pathname.replace(/^\//, '') === 'auth');
	const isAuthHttps =
		(parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
		parsed.pathname.startsWith('/auth');
	return isAuthScheme || isAuthHttps;
}

/** Opt-in web analytics may inject only in a browser non-native shell. */
export function webAnalyticsAvailable(opts: { browser: boolean; native: boolean }): boolean {
	return opts.browser && !opts.native;
}
