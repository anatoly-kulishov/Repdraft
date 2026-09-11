import type { ExerciseIndexItem, WorkoutPlan } from './types';
import { labelTarget } from './labels.ru';
import type { AppLocale } from '$lib/i18n/locale';

/** Unique catalog `target` keys in plan order. */
export function planTargetKeys(
	plan: WorkoutPlan,
	indexById: Map<string, ExerciseIndexItem>
): string[] {
	const seen = new Set<string>();
	const keys: string[] = [];
	for (const ex of plan.exercises) {
		const target = indexById.get(ex.exerciseId)?.target?.trim();
		if (!target || seen.has(target)) continue;
		seen.add(target);
		keys.push(target);
	}
	return keys;
}

/** True when the plan includes at least one exercise with this catalog target key. */
export function planHasTarget(
	plan: WorkoutPlan,
	indexById: Map<string, ExerciseIndexItem>,
	target: string
): boolean {
	for (const ex of plan.exercises) {
		if (indexById.get(ex.exerciseId)?.target === target) return true;
	}
	return false;
}

/** Distinct targets across plans, sorted by localized label. */
export function collectPlanTargetFacets(
	plans: readonly WorkoutPlan[],
	indexById: Map<string, ExerciseIndexItem>,
	locale: AppLocale = 'ru'
): string[] {
	const seen = new Set<string>();
	for (const plan of plans) {
		for (const key of planTargetKeys(plan, indexById)) seen.add(key);
	}
	return [...seen].sort((a, b) =>
		labelTarget(a, locale).localeCompare(labelTarget(b, locale), locale)
	);
}

/** Unique target muscle labels for plan cards (order preserved, capped). */
export function planTargetSummary(
	plan: WorkoutPlan,
	indexById: Map<string, ExerciseIndexItem>,
	locale: AppLocale = 'ru',
	maxLabels = 4
): string {
	const parts: string[] = [];
	for (const key of planTargetKeys(plan, indexById)) {
		parts.push(labelTarget(key, locale));
		if (parts.length >= maxLabels) break;
	}
	return parts.join(' · ');
}
