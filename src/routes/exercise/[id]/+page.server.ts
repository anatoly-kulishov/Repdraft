import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { articlesForExercise, type Article } from '$lib/domain/articles';
import { getExerciseById } from '$lib/server/exerciseCatalog';
import type { PageServerLoad } from './$types';

function loadArticlesLocal(): Article[] {
	const raw = readFileSync(join(process.cwd(), 'static/content/articles.json'), 'utf8');
	return JSON.parse(raw) as Article[];
}

export const load: PageServerLoad = ({ params }) => {
	const exercise = getExerciseById(params.id);
	const relatedArticles = exercise
		? articlesForExercise(loadArticlesLocal(), exercise.id)
		: [];
	return { exercise, relatedArticles };
};
