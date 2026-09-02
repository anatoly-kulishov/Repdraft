import { catalogHubSitemapPaths } from '$lib/domain/catalogLinks';

/** Public marketing/catalog routes safe to prerender (no user session UI). */
export const PRERENDER_PUBLIC = true as const;

export function catalogPrerenderEntries(): { bodyPart: string }[] {
	return catalogHubSitemapPaths().map((path) => {
		const segment = path.replace(/^\/catalog\//, '');
		return { bodyPart: decodeURIComponent(segment) };
	});
}

/** Static poster for social previews; animated GIF stays on the page. */
export function exerciseOgImagePath(
	exercise: { image?: string; gif_url?: string } | null | undefined
): string | undefined {
	if (!exercise) return undefined;
	if (exercise.image) return `/${exercise.image}`;
	if (exercise.gif_url) return `/${exercise.gif_url}`;
	return undefined;
}
