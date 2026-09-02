import { articlePrerenderEntries } from '$lib/seo/prerenderEntries.server';

export function entries() {
	return articlePrerenderEntries();
}
