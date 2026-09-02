import { browser } from '$app/environment';

/**
 * Safe URLSearchParams for SSR and prerender routes.
 * `url.search` / `url.searchParams` throw while SvelteKit prerender is enabled.
 */
export function urlSearchParams(url: URL): URLSearchParams {
	if (browser) return url.searchParams;
	try {
		return new URLSearchParams(url.search);
	} catch {
		return new URLSearchParams();
	}
}

export function readSearchParam(url: URL, key: string): string | null {
	return urlSearchParams(url).get(key);
}

export function readSearchParams(url: URL): URLSearchParams {
	return urlSearchParams(url);
}

/** Query string including `?`, empty when prerender forbids reading search. */
export function searchSuffix(url: URL): string {
	if (browser) return url.search;
	try {
		return url.search;
	} catch {
		return '';
	}
}

/** Path + query for auth `next=` redirects. */
export function pathWithSearch(url: URL): string {
	if (!browser) {
		try {
			return `${url.pathname}${url.search}`;
		} catch {
			return url.pathname;
		}
	}
	return `${url.pathname}${url.search}`;
}
