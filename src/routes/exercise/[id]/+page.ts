import { articlesForExercise } from '$lib/domain/articles';
import { loadArticles } from '$lib/data/loadArticles';
import { getExerciseById } from '$lib/data/loadExerciseCatalog';
import type { PageLoad } from './$types';

/** Dynamic exercise pages stay SSR — 1300+ entries, user-specific tabs. */
export const prerender = false;

export const load: PageLoad = async ({ params, fetch }) => {
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
