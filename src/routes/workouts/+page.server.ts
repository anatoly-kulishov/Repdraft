import {
	WORKOUTS_HISTORY_SKELETON_ROW_LIMIT,
	WORKOUTS_PLANS_SKELETON_ROW_LIMIT
} from '$lib/domain/home';
import type { PageServerLoad } from './$types';

function capRowCount(raw: string | undefined, max: number): number {
	const parsed = raw ? Number.parseInt(raw, 10) : 0;
	return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), max) : 0;
}

/** Cookie peek set in app.html before Svelte mounts. */
export const load: PageServerLoad = ({ cookies }) => {
	const planRows = capRowCount(
		cookies.get('repdraft_workouts_plan_rows'),
		WORKOUTS_PLANS_SKELETON_ROW_LIMIT
	);
	const historyRows = capRowCount(
		cookies.get('repdraft_workouts_history_rows'),
		WORKOUTS_HISTORY_SKELETON_ROW_LIMIT
	);
	const hasHistory = cookies.get('repdraft_home_has_history') === '1';
	return {
		bootPeek: { planRows, historyRows, hasHistory }
	};
};
