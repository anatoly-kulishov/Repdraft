import {
	isArticleHierarchyNav,
	isCatalogHierarchyNav
} from '$lib/dom/hierarchyViewTransition';

/** True for `/workouts/{planId}` preview (not summary / history / live). */
export function isWorkoutPlanPreviewPath(pathname: string): boolean {
	if (!/^\/workouts\/[^/]+$/.test(pathname)) return false;
	return pathname !== '/workouts/summary';
}

/**
 * Soft opaque root VT for list ↔ detail and catalog/article hierarchy.
 * Shared-element morphs are media/cover only (not titles) — see exerciseMedia / article cover.
 * Tab switches stay instant (avoids light-theme flash).
 */
export function shouldUseSharedViewTransition(fromPath: string, toPath: string): boolean {
	const exercise = (p: string) => p.startsWith('/exercise/');
	const history = (p: string) => p.startsWith('/workouts/history/');
	if (exercise(fromPath) || exercise(toPath)) return true;
	if (history(fromPath) || history(toPath)) return true;
	if (isWorkoutPlanPreviewPath(fromPath) || isWorkoutPlanPreviewPath(toPath)) return true;
	if (isCatalogHierarchyNav(fromPath, toPath)) return true;
	if (isArticleHierarchyNav(fromPath, toPath)) return true;
	return false;
}
