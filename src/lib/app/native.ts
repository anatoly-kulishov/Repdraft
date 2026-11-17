import { browser } from '$app/environment';
import { resolveWebApiOrigin } from '$lib/app/nativeUrls';

/** Absolute origin for account APIs (delete/avatar). Prefers PUBLIC_WEB_ORIGIN / PUBLIC_SITE_URL. */
export function webApiOrigin(): string {
	return resolveWebApiOrigin({
		webOrigin: import.meta.env.PUBLIC_WEB_ORIGIN,
		siteUrl: import.meta.env.PUBLIC_SITE_URL,
		browserOrigin: browser && typeof window !== 'undefined' ? window.location?.origin : ''
	});
}
