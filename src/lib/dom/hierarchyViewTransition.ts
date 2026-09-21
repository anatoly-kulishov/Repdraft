import { writable } from 'svelte/store';

/**
 * Shared morph: article list cover ↔ article hero cover.
 * Catalog hub ↔ zone uses soft opaque root only (no title morph).
 */

export const armedArticleCoverVtId = writable<string | null>(null);

function vtIdent(prefix: string, id: string): string {
	const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_');
	return `${prefix}-${safe}`;
}

export function articleCoverViewTransitionName(slug: string): string {
	return vtIdent('rd-art', slug);
}

export function armArticleCoverViewTransition(slug: string): void {
	armedArticleCoverVtId.set(slug);
}

export function clearArmedArticleCoverViewTransition(): void {
	armedArticleCoverVtId.set(null);
}

function isCatalogHubPath(pathname: string): boolean {
	return pathname === '/exercises';
}

function isCatalogZonePath(pathname: string): boolean {
	return pathname.startsWith('/catalog/');
}

function isArticlesHubPath(pathname: string): boolean {
	return pathname === '/articles';
}

function isArticleDetailPath(pathname: string): boolean {
	return /^\/articles\/[^/]+$/.test(pathname);
}

/** Hub ↔ zone (and zone ↔ zone). Not hub ↔ other tabs. */
export function isCatalogHierarchyNav(fromPath: string, toPath: string): boolean {
	const hubFrom = isCatalogHubPath(fromPath);
	const hubTo = isCatalogHubPath(toPath);
	const zoneFrom = isCatalogZonePath(fromPath);
	const zoneTo = isCatalogZonePath(toPath);
	if (hubFrom && zoneTo) return true;
	if (zoneFrom && hubTo) return true;
	if (zoneFrom && zoneTo) return true;
	return false;
}

export function isArticleHierarchyNav(fromPath: string, toPath: string): boolean {
	if (isArticlesHubPath(fromPath) && isArticleDetailPath(toPath)) return true;
	if (isArticleDetailPath(fromPath) && isArticlesHubPath(toPath)) return true;
	return false;
}

export function clearArmedHierarchyViewTransitions(toPath: string): void {
	if (!isArticleDetailPath(toPath)) {
		clearArmedArticleCoverViewTransition();
	}
}
