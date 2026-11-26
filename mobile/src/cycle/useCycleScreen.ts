import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { AthleteGoalId } from '@repdraft/domain/athleteProfile';
import {
	cycleProgressNow,
	cycleWeekVariant,
	cycleWeeksSummary,
	newCycle,
	type CycleLength,
	type Mesocycle
} from '@repdraft/domain/cycle';
import { cycleTargetWeights, cycleWeekTargets } from '@repdraft/domain/cycleTargets';
import {
	fillOpenWeightsFromHistory,
	lastPerformance,
	previousSetAtIndex,
	startSessionFromPlan
} from '@repdraft/domain/session';
import type { WorkoutPlan, WorkoutSession } from '@repdraft/domain/types';
import { planWithResolvedMeasures } from '@repdraft/domain/workout';
import { loadExerciseIndex } from '../catalog/loadIndex';
import { useLocale } from '../state/locale';
import { clearCycle, readCycle, writeCycle } from '../state/cycle';
import { plansRepo } from '../storage/plansRepo';
import { readActiveSession, sessionsRepo, writeActiveSession } from '../storage/sessionsRepo';

export type CycleDraftInput = {
	name: string;
	goal: AthleteGoalId;
	weeks: CycleLength;
	planIds: string[];
};

export function useCycleScreen() {
	const router = useRouter();
	const { tt } = useLocale();
	const [cycle, setCycle] = useState<Mesocycle | null>(null);
	const [plans, setPlans] = useState<WorkoutPlan[]>([]);
	const [history, setHistory] = useState<WorkoutSession[]>([]);
	const [loading, setLoading] = useState(true);
	const [busyPlanId, setBusyPlanId] = useState<string | null>(null);

	const reload = useCallback(async () => {
		const [stored, planList, sessions] = await Promise.all([
			readCycle(),
			plansRepo.list(),
			sessionsRepo.list()
		]);
		setCycle(stored);
		setPlans(planList);
		setHistory(sessions.filter((session) => session.finishedAt));
		setLoading(false);
	}, []);

	useFocusEffect(
		useCallback(() => {
			void reload();
		}, [reload])
	);

	const weeks = useMemo(
		() => (cycle ? cycleWeeksSummary(cycle, history) : []),
		[cycle, history]
	);
	const progress = useMemo(() => (cycle ? cycleProgressNow(cycle) : null), [cycle]);
	const totalPlanned = cycle ? cycle.weeks * cycle.planIds.length : 0;
	const totalDone = useMemo(
		() => weeks.reduce((sum, week) => sum + week.done, 0),
		[weeks]
	);

	const create = useCallback(
		async (input: CycleDraftInput) => {
			const name = input.name.trim() || tt('cycle.defaultName');
			const next = newCycle({
				name,
				goal: input.goal,
				weeks: input.weeks,
				planIds: input.planIds
			});
			setCycle(await writeCycle(next));
			return next;
		},
		[tt]
	);

	const reset = useCallback(async () => {
		await clearCycle();
		setCycle(null);
	}, []);

	const startWeek = useCallback(
		async (plan: WorkoutPlan, week: number) => {
			if (!cycle) return;
			const active = await readActiveSession();
			if (active && !active.finishedAt) {
				Alert.alert(tt('cycle.activeSession'), undefined, [
					{ text: tt('common.cancel'), style: 'cancel' },
					{
						text: tt('cycle.open'),
						onPress: () => router.push(`/live/${active.planId ?? 'active'}`)
					}
				]);
				return;
			}
			setBusyPlanId(plan.id);
			try {
				const variant = cycleWeekVariant(plan, week, cycle, {
					weekLabel: tt('cycle.variantTag', { week })
				});
				const catalog = new Map(loadExerciseIndex().map((item) => [item.id, item] as const));
				const targets = cycleWeekTargets(plan, week, cycle, {
					sessions: history,
					equipmentFor: (exerciseId) => catalog.get(exerciseId)?.equipment ?? null
				});
				// The week's sets/reps/load land in the session; history only fills a gap.
				const started = startSessionFromPlan(
					planWithResolvedMeasures(variant, (id) => catalog.get(id) ?? null),
					{
						lockPrescription: true,
						weights: cycleTargetWeights(targets)
					}
				);
				const session = fillOpenWeightsFromHistory(
					started,
					(exerciseId, setIndex) =>
						previousSetAtIndex(history, exerciseId, setIndex)?.weightKg ??
						lastPerformance(history, exerciseId)?.weightKg ??
						null
				);
				await writeActiveSession(session);
				router.push(`/live/${plan.id}`);
			} finally {
				setBusyPlanId(null);
			}
		},
		[cycle, history, router, tt]
	);

	return {
		loading,
		cycle,
		plans,
		history,
		weeks,
		progress,
		totalPlanned,
		totalDone,
		busyPlanId,
		create,
		reset,
		startWeek,
		reload
	};
}
