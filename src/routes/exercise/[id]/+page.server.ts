import { articlesForExercise } from '$lib/domain/articles';
import { loadArticles } from '$lib/data/loadArticles';
import { getExerciseById } from '$lib/server/exerciseCatalog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const exercise = getExerciseById(params.id);
	if (!exercise) {
		return { exercise: null, relatedArticles: [] };
	}

	// Vercel serverless has no `static/` on disk — use SvelteKit fetch (CDN/static assets).
	let relatedArticles: Awaited<ReturnType<typeof articlesForExercise>> = [];
	try {
		const articles = await loadArticles(fetch);
		relatedArticles = articlesForExercise(articles, exercise.id);
	} catch {
		relatedArticles = [];
	}

	return { exercise, relatedArticles };
};
