import { articlesForExercise } from '$lib/domain/articles';
import { loadArticles } from '$lib/data/loadArticles';
import { getExerciseById } from '$lib/data/loadExerciseCatalog';
import type { PageServerLoad } from './$types';

/** Dynamic exercise pages stay SSR — 1300+ entries, user-specific tabs. */
export const prerender = false;

/**
 * Server load, not universal: `getExerciseById` reads the ~15MB full catalog, and a
 * universal load makes SvelteKit inline every fetch response into the HTML for hydration
 * (`data-sveltekit-fetched`) — 12MB of JSON in one inline script per exercise page.
 * Here only the one exercise + related articles cross the wire; the catalog stays in
 * server memory (module-level cache), reused across all 1300+ requests per instance.
 */
export const load: PageServerLoad = async ({ params, fetch }) => {
	const exercise = await getExerciseById(params.id, fetch);
	if (!exercise) {
		return { exercise: null, relatedArticles: [] };
	}

	let relatedArticles: Awaited<ReturnType<typeof articlesForExercise>> = [];
	try {
		const articles = await loadArticles(fetch);
		relatedArticles = articlesForExercise(articles, exercise.id);
	} catch {
		relatedArticles = [];
	}

	return { exercise, relatedArticles };
};
