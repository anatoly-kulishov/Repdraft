import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { clampPlanName } from '@repdraft/domain/inputLimits';
import {
	PROGRAMS,
	buildSessionExercises,
	findProgram,
	programProgressView,
	programShortName,
	sessionPrescription,
	sessionTitle,
	type ProgramRun,
	type ProgramSessionTemplate
} from '@repdraft/domain/programs';
import {
	lastPerformance,
	previousSetAtIndex,
	seedOpenSetsFromLastPerformance,
	startSessionFromPlan
} from '@repdraft/domain/session';
import { createEmptyDraft } from '@repdraft/domain/workout';
import type { WorkoutSession } from '@repdraft/domain/types';
import { loadExerciseIndex, refreshCustomsCache } from '../catalog/loadIndex';
import { useLocale } from '../state/locale';
import { plansRepo } from '../storage/plansRepo';
import { programsRepo } from '../storage/programsRepo';
import { readActiveSession, sessionsRepo, writeActiveSession } from '../storage/sessionsRepo';
import { pushPlan } from '../sync/cloudSync';

function finishedPlanIds(sessions: WorkoutSession[]): Set<string> {
	return new Set(
		sessions
			.filter((session) => session.finishedAt && session.planId)
			.map((session) => session.planId as string)
	);
}

/** Hub state: runs, saved marks and the program list in saved-first order. */
export function useProgramsHub() {
	const [runs, setRuns] = useState<Record<string, ProgramRun>>({});
	const [savedSlugs, setSavedSlugs] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);

	const reload = useCallback(async () => {
		const sessions = await sessionsRepo.list();
		const [nextRuns, saved] = await Promise.all([
			programsRepo.syncFinished(finishedPlanIds(sessions)),
			programsRepo.saved()
		]);
		setRuns(nextRuns);
		setSavedSlugs(saved);
		setLoading(false);
	}, []);

	useFocusEffect(
		useCallback(() => {
			void reload();
		}, [reload])
	);

	/* Saved blocks float up; sort is stable, the rest keeps its order. */
	const items = useMemo(
		() =>
			[...PROGRAMS]
				.sort(
					(a, b) =>
						Number(savedSlugs.includes(b.slug)) - Number(savedSlugs.includes(a.slug))
				)
				.map((program) => ({
					program,
					progress: programProgressView(program, runs[program.slug] ?? null)
				})),
		[runs, savedSlugs]
	);

	const toggleSaved = useCallback(async (slug: string) => {
		const result = await programsRepo.toggleSaved(slug);
		setSavedSlugs(result.slugs);
	}, []);

	return { loading, items, runs, savedSlugs, toggleSaved, reload };
}

/** Detail state + the one action the screen exists for: start a session. */
export function useProgramDetail(slug: string) {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const [run, setRun] = useState<ProgramRun | null>(null);
	const [history, setHistory] = useState<WorkoutSession[]>([]);
	const [loading, setLoading] = useState(true);
	const [startingKey, setStartingKey] = useState<string | null>(null);

	const program = findProgram(slug);

	const reload = useCallback(async () => {
		const sessions = await sessionsRepo.list();
		const runs = await programsRepo.syncFinished(finishedPlanIds(sessions));
		setRun(runs[slug] ?? null);
		setHistory(sessions.filter((session) => session.finishedAt));
		setLoading(false);
	}, [slug]);

	useFocusEffect(
		useCallback(() => {
			void reload();
		}, [reload])
	);

	const progress = useMemo(
		() => (program ? programProgressView(program, run) : null),
		[program, run]
	);

	const startSession = useCallback(
		async (week: number, session: ProgramSessionTemplate) => {
			if (!program || startingKey) return;
			const active = await readActiveSession();
			if (active && !active.finishedAt) {
				Alert.alert(tt('programs.activeSession'), undefined, [
					{ text: tt('common.cancel'), style: 'cancel' },
					{
						text: tt('cycle.open'),
						onPress: () => router.push(`/live/${active.planId ?? 'active'}`)
					}
				]);
				return;
			}
			setStartingKey(`${week}:${session.id}`);
			try {
				await refreshCustomsCache();
				const catalog = loadExerciseIndex();
				const prescription = sessionPrescription(session, week);
				const exercises = buildSessionExercises({
					session,
					prescription,
					catalog,
					equipment: program.equipment
				});
				if (exercises.length === 0) {
					Alert.alert(tt('programs.startFail'));
					return;
				}
				const draft = createEmptyDraft(
					clampPlanName(
						`${programShortName(program, locale)} · ${tt('programs.weekShort', {
							n: week
						})} · ${sessionTitle(session, locale)}`
					)
				);
				const plan = { ...draft, exercises, updatedAt: new Date().toISOString() };
				await plansRepo.save(plan);
				try {
					await pushPlan(plan);
				} catch {
					/* offline: the local plan is enough to train */
				}
				await programsRepo.startSlot(program.slug, week, session.id, plan.id);
				const activeSession = seedOpenSetsFromLastPerformance(
					startSessionFromPlan(plan, { lockPrescription: true }),
					(exerciseId) => lastPerformance(history, exerciseId),
					(exerciseId, setIndex) => previousSetAtIndex(history, exerciseId, setIndex)
				);
				await writeActiveSession(activeSession);
				router.push(`/live/${plan.id}`);
			} catch {
				Alert.alert(tt('programs.startFail'));
			} finally {
				setStartingKey(null);
			}
		},
		[history, locale, program, router, startingKey, tt]
	);

	return { program, run, progress, history, loading, startingKey, startSession, reload };
}
