import { getExerciseById } from '$lib/data/loadExerciseCatalog';
import { corsJson, corsPreflight } from '$lib/server/cors';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const OPTIONS: RequestHandler = async () => corsPreflight();

/** Public technique payload for RN / thin clients (no auth). */
export const GET: RequestHandler = async ({ params, fetch }) => {
	const id = params.id?.trim();
	if (!id) error(400, 'missing id');
	const exercise = await getExerciseById(id, fetch);
	if (!exercise) error(404, 'not found');
	return corsJson({
		id: exercise.id,
		name: exercise.name,
		name_ru: exercise.name_ru ?? '',
		body_part: exercise.body_part,
		equipment: exercise.equipment,
		target: exercise.target,
		image: exercise.image,
		instructions: exercise.instructions ?? {},
		instruction_steps: exercise.instruction_steps ?? {}
	});
};
