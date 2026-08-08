import { getExerciseById } from '$lib/server/exerciseCatalog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	return {
		exercise: getExerciseById(params.id)
	};
};
