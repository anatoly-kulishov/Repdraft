import type { RequestEvent } from './$types';
import {
	load as exerciseLoad,
	type ExercisePageData
} from '../../../exercise/[id]/+page.server';

/** Dynamic like the Russian page: 1300+ entries, never prerendered. */
export const prerender = false;

/** Same catalog load as `/exercise/:id`; only the URL language differs. */
export const load = async (event: RequestEvent): Promise<ExercisePageData> => {
	const data = await exerciseLoad(event as unknown as Parameters<typeof exerciseLoad>[0]);
	return data as unknown as ExercisePageData;
};
