import { articlesForExercise } from '$lib/domain/articles';
import { loadArticles } from '$lib/data/loadArticles';
import { getExerciseById } from '$lib/data/loadExerciseCatalog';
import type { Article } from '$lib/domain/articles';
import type { Exercise } from '$lib/domain/types';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Shared by the `/en/exercise/:id` mirror, so both routes load the same shape.
 * `exercise` is never null: an unknown id throws 404 in the load below.
 */
export type ExercisePageData = {
	exercise: Exercise;
	relatedArticles: Article[];
};

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
	// A bad id must 404: a 200 with `noindex` still looks like a live page.
	if (!exercise) error(404, 'Exercise not found');

	let relatedArticles: Awaited<ReturnType<typeof articlesForExercise>> = [];
	try {
		const articles = await loadArticles(fetch);
		relatedArticles = articlesForExercise(articles, exercise.id);
	} catch {
		relatedArticles = [];
	}

	return { exercise, relatedArticles };
};
