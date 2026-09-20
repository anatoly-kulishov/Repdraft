/**
 * Pure URL helpers for web delivery.
 * Keep free of DOM and $app so Node selfchecks can run them.
 */

/** Absolute origin for account APIs when env points at a deployed site. */
export function resolveWebApiOrigin(opts: {
	webOrigin?: string | null;
	siteUrl?: string | null;
	browserOrigin?: string | null;
}): string {
	const fromEnv = (opts.webOrigin ?? opts.siteUrl ?? '').trim().replace(/\/$/, '');
	if (fromEnv.startsWith('https://') || fromEnv.startsWith('http://')) return fromEnv;
	return (opts.browserOrigin ?? '').trim().replace(/\/$/, '');
}

/** Whether an open-URL should hydrate Supabase auth. */
export function isAuthDeepLinkUrl(raw: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return false;
	}

	const isAuthHttps =
		(parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
		parsed.pathname.startsWith('/auth');
	return isAuthHttps;
}

/** Opt-in web analytics may inject only in the browser. */
export function webAnalyticsAvailable(opts: { browser: boolean }): boolean {
	return opts.browser;
}
