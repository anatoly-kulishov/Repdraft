import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	FlatList,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import {
	LIVE_REPS,
	coerceReps,
	coerceWeightKg,
	filterRepsInput,
	filterWeightInput
} from '@repdraft/domain/inputLimits';
import { RECORDS_STORAGE_KEY } from '@repdraft/domain/repository';
import {
	addLoggedSet,
	altGroupNeedsPick,
	applyRepsToOpenSets,
	applyWeightToOpenSets,
	chooseAltExercise,
	completedSetCount,
	exerciseBestWeightKg,
	finishSession,
	isSessionFullyLogged,
	lastPerformance,
	loggedSetKind,
	nextFocusAfterSetComplete,
	nextManualExerciseFocus,
	nextSetKind,
	previousSetAtIndex,
	removeLoggedSet,
	restSecAfterSet,
	seedOpenSetsFromLastPerformance,
	setKindMessageKey,
	skipSessionExercise,
	startSessionFromPlan,
	syncSessionPrescriptionFromPlan,
	totalSetCount,
	updateExerciseNote,
	updateLoggedSet,
	visibleSessionExerciseIndices
} from '@repdraft/domain/session';
import { XP_WEIGHT_UP } from '@repdraft/domain/quest';
import { exerciseWeightByWeek, nextWeightHint, weightAboveLast } from '@repdraft/domain/sessionPayoff';
import { isBodyweightEquipment, isCardioBodyPart } from '@repdraft/domain/workout';
import type { QuestHeroProfile } from '@repdraft/domain/questHeroProfile';
import type { LoggedSet, WorkoutPlan, WorkoutSession } from '@repdraft/domain/types';
import { unlockRestAudioFromGesture } from '../../src/audio/restChime';
import { signalRestDone } from '../../src/audio/restDone';
import { exerciseDisplayName, getIndexItem, refreshCustomsCache } from '../../src/catalog/loadIndex';
import { Chip } from '../../src/components/Chip';
import { ConfirmSheet, type ConfirmAction } from '../../src/components/ConfirmSheet';
import { ElapsedClock } from '../../src/components/ElapsedClock';
import { LiveSetRow, type SetDraft } from '../../src/components/LiveSetRow';
import { QuestOnboardingSheet } from '../../src/components/QuestOnboardingSheet';
import { Panel } from '../../src/components/Panel';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { RestTimer } from '../../src/components/RestTimer';
import { PageSkeleton } from '../../src/components/PageSkeleton';
import { TechniqueSheet } from '../../src/components/TechniqueSheet';
import { advanceHomeNextAfterFinish } from '../../src/live/homeNext';
import { movePlanToEnd } from '../../src/live/planOrder';
import { readRestUntil, shiftRestUntil, writeRestUntil } from '../../src/live/restUntil';
import {
	exerciseAllSetsDone,
	isLiveResumePlanId,
	pickDefaultExerciseIndex
} from '../../src/live/sessionUi';
import {
	countImprovedRecords,
	mergeSessionRecordsInto,
	recordsFromFinishedSession
} from '@repdraft/domain/sessionRecords';
import { noteFinishedSessionAchievements } from '../../src/state/achievements';
import { isHealthReadEnabled } from '../../src/state/healthPrefs';
import { getHealthAdapter, saveLastHealthSnapshot } from '../../src/health';
import { useLocale } from '../../src/state/locale';
import { noteChecklist } from '../../src/state/onboarding';
import { noteFinishedSession } from '../../src/state/quest';
import { needsQuestHeroOnboarding, saveQuestHeroProfile } from '../../src/state/questHero';
import { useAppColors } from '../../src/state/theme';
import { kvSetJson } from '../../src/storage/kv';
import { plansRepo } from '../../src/storage/plansRepo';
import { recordsRepo } from '../../src/storage/recordsRepo';
import {
	readActiveSession,
	sessionsRepo,
	writeActiveSession
} from '../../src/storage/sessionsRepo';
import { useBottomChromePad, useStackHeaderOffset } from '../../src/layout/safe';
import { pushPlan, pushRecord, pushSession } from '../../src/sync/cloudSync';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../../src/theme';

/** ponytail: last-set hints only need recent finishes. Upgrade path: per-exercise index. */
const HINT_SESSION_CAP = 30;

function hintSessions(sessions: WorkoutSession[]): WorkoutSession[] {
	return sessions
		.filter((s) => s.finishedAt)
		.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
		.slice(0, HINT_SESSION_CAP);
}

function tapLight(): void {
	void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

type DraftRow = SetDraft;

export default function LiveScreen() {
	const { planId: planIdParam } = useLocalSearchParams<{ planId: string }>();
	const planId = Array.isArray(planIdParam) ? planIdParam[0] : planIdParam;
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.md);
	const headerOffset = useStackHeaderOffset();

	const [session, setSession] = useState<WorkoutSession | null>(null);
	const [history, setHistory] = useState<WorkoutSession[]>([]);
	const [selectedEi, setSelectedEi] = useState(0);
	const [drafts, setDrafts] = useState<DraftRow[]>([]);
	const [noteText, setNoteText] = useState('');
	const [restUntil, setRestUntil] = useState<number | null>(null);
	const [finishing, setFinishing] = useState(false);
	const [bootReady, setBootReady] = useState(false);
	const [heroPlan, setHeroPlan] = useState<WorkoutPlan | null>(null);
	const [forceAltPick, setForceAltPick] = useState(false);
	const [techniqueId, setTechniqueId] = useState<string | null>(null);
	const [confirm, setConfirm] = useState<{
		title: string;
		message?: string;
		actions: ConfirmAction[];
		showCancel?: boolean;
	} | null>(null);
	const finishOfferedRef = useRef(false);

	const persist = useCallback(async (next: WorkoutSession, nextRest: number | null = restUntil) => {
		setSession(next);
		await writeActiveSession(next);
		await writeRestUntil(nextRest);
		setRestUntil(nextRest);
	}, [restUntil]);

	const beginSession = useCallback(
		async (plan: WorkoutPlan, hist: WorkoutSession[]) => {
			setHeroPlan(null);
			let started = startSessionFromPlan(plan);
			started = seedOpenSetsFromLastPerformance(started, (exerciseId) =>
				lastPerformance(hist, exerciseId)
			);
			await writeActiveSession(started);
			await writeRestUntil(null);
			setRestUntil(null);
			setSession(started);
			setSelectedEi(pickDefaultExerciseIndex(started));
			finishOfferedRef.current = false;
		},
		[]
	);

	const startNew = useCallback(
		async (plan: WorkoutPlan, hist: WorkoutSession[]) => {
			if (await needsQuestHeroOnboarding()) {
				setHistory(hist);
				setHeroPlan(plan);
				return;
			}
			await beginSession(plan, hist);
		},
		[beginSession]
	);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			await refreshCustomsCache();
			await noteChecklist('liveEntered');
			const [active, hist, rest] = await Promise.all([
				readActiveSession(),
				sessionsRepo.list(),
				readRestUntil()
			]);
			if (cancelled) return;
			const hints = hintSessions(hist);
			setHistory(hints);
			setRestUntil(rest);

			const resumeActive = async (activeSession: WorkoutSession) => {
				let next = activeSession;
				if (next.planId) {
					const plan = await plansRepo.get(next.planId);
					if (plan) next = syncSessionPrescriptionFromPlan(next, plan);
				}
				if (cancelled) return;
				if (next !== activeSession) await writeActiveSession(next);
				setSession(next);
				setSelectedEi(pickDefaultExerciseIndex(next));
				if (isSessionFullyLogged(next)) offerFinish(next);
			};

			if (active && !active.finishedAt && active.exercises.length > 0) {
				if (!planId || isLiveResumePlanId(planId, active)) {
					await resumeActive(active);
					if (!cancelled) setBootReady(true);
					return;
				}
				if (active.planId && active.planId !== planId) {
					const plan = planId ? await plansRepo.get(planId) : null;
					if (!plan || plan.exercises.length === 0) {
						await resumeActive(active);
						if (!cancelled) setBootReady(true);
						return;
					}
					if (!cancelled) {
						setBootReady(true);
						setConfirm({
							title: tt('live.switchStartNew'),
							message: tt('live.switchOfferHint'),
							actions: [
								{
									label: tt('live.switchKeepCurrent'),
									variant: 'secondary',
									onPress: () => {
										router.replace(`/live/${active.planId}`);
									}
								},
								{
									label: tt('live.switchStartNew'),
									variant: 'danger',
									onPress: () => {
										void startNew(plan, hints);
									}
								}
							]
						});
					}
					return;
				}
			}

			if (!planId) {
				if (!cancelled) {
					setBootReady(true);
					router.replace('/');
				}
				return;
			}
			const plan = await plansRepo.get(planId);
			if (!plan || plan.exercises.length === 0) {
				if (!cancelled) {
					setBootReady(true);
					router.replace('/');
				}
				return;
			}
			await startNew(plan, hints);
			if (!cancelled) setBootReady(true);
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- boot once per planId
	}, [planId]);

	useEffect(() => {
		void activateKeepAwakeAsync('live-session');
		return () => {
			void deactivateKeepAwake('live-session');
		};
	}, []);

	const visible = useMemo(
		() => (session ? visibleSessionExerciseIndices(session) : []),
		[session]
	);
	const ex = session?.exercises[selectedEi] ?? null;
	const needsAlt = Boolean(
		session && ex && (forceAltPick || altGroupNeedsPick(session, selectedEi))
	);
	const skipLift = Boolean(ex && isCardioBodyPart(getIndexItem(ex.exerciseId)?.body_part));
	const bodyweight = Boolean(
		ex && isBodyweightEquipment(getIndexItem(ex.exerciseId)?.equipment)
	);

	useEffect(() => {
		if (!session || !ex || needsAlt) {
			setDrafts([]);
			setNoteText('');
			return;
		}
		setNoteText(ex.note ?? '');
		setDrafts(
			ex.sets.map((set, si) => {
				const prev = previousSetAtIndex(history, ex.exerciseId, si);
				return {
					weight:
						set.weightKg != null
							? String(set.weightKg)
							: prev?.weightKg != null
								? String(prev.weightKg)
								: '',
					reps:
						set.reps != null
							? String(set.reps)
							: prev?.reps != null
								? String(prev.reps)
								: String(ex.targetReps ?? '')
				};
			})
		);
	}, [session, selectedEi, history, needsAlt, ex?.exerciseId, ex?.sets.length]);

	function offerFinish(current: WorkoutSession) {
		if (finishOfferedRef.current || finishing) return;
		if (!isSessionFullyLogged(current)) return;
		finishOfferedRef.current = true;
		setConfirm({
			title: tt('live.finishOfferReady'),
			message: tt('live.finishOfferHint'),
			showCancel: false,
			actions: [
				{
					label: tt('live.finishOfferLater'),
					variant: 'secondary',
					onPress: () => {
						finishOfferedRef.current = false;
					}
				},
				{
					label: tt('live.finish'),
					onPress: () => void commitFinish(current)
				}
			]
		});
	}

	async function setRestFromSec(sec: number) {
		if (sec > 0) unlockRestAudioFromGesture();
		const next = sec > 0 ? Date.now() + sec * 1000 : null;
		await writeRestUntil(next);
		setRestUntil(next);
	}

	function adjustRest(deltaSec: number) {
		if (restUntil == null) return;
		unlockRestAudioFromGesture();
		const next = shiftRestUntil(restUntil, deltaSec);
		void writeRestUntil(next).then(() => setRestUntil(next));
	}

	const finishRest = useCallback(() => {
		void signalRestDone();
		void writeRestUntil(null).then(() => setRestUntil(null));
	}, []);

	async function patchSet(
		ei: number,
		si: number,
		patch: Partial<Pick<LoggedSet, 'weightKg' | 'reps' | 'completed' | 'kind'>>,
		opts?: { afterComplete?: boolean }
	) {
		if (!session) return;
		const next = updateLoggedSet(session, ei, si, patch);
		let nextRest = restUntil;
		if (patch.completed === true) {
			const sec = restSecAfterSet(next, ei, si);
			if (sec > 0) unlockRestAudioFromGesture();
			nextRest = sec > 0 ? Date.now() + sec * 1000 : null;
		}
		await persist(next, nextRest);
		if (opts?.afterComplete) {
			tapLight();
			await noteChecklist('setLogged');
			const focusEi = nextFocusAfterSetComplete(next, ei, si);
			setSelectedEi(focusEi);
			if (isSessionFullyLogged(next)) {
				await setRestFromSec(0);
				offerFinish(next);
			}
		}
	}

	function validateLift(set: { weightKg: number | null; reps: number | null }): boolean {
		if (skipLift) return true;
		if (set.weightKg != null && !coerceWeightKg(String(set.weightKg))) {
			setConfirm({ title: tt('live.invalidWeight'), actions: [] });
			return false;
		}
		if (
			set.reps == null ||
			!Number.isInteger(set.reps) ||
			set.reps < LIVE_REPS.min ||
			set.reps > LIVE_REPS.max
		) {
			setConfirm({ title: tt('live.invalidReps'), actions: [] });
			return false;
		}
		return true;
	}

	async function syncDraftToSession(ei: number, si: number): Promise<WorkoutSession | null> {
		if (!session) return null;
		const row = drafts[si];
		if (!row) return session;
		const weightFiltered = filterWeightInput(row.weight);
		const repsFiltered = filterRepsInput(row.reps, LIVE_REPS);
		const weightKg = weightFiltered ? coerceWeightKg(weightFiltered) : null;
		const reps = repsFiltered ? coerceReps(repsFiltered, LIVE_REPS) : null;
		const next = updateLoggedSet(session, ei, si, { weightKg, reps });
		await persist(next, restUntil);
		return next;
	}

	async function onComplete(ei: number, si: number) {
		const synced = await syncDraftToSession(ei, si);
		if (!synced) return;
		const set = synced.exercises[ei]?.sets[si];
		if (!set) return;
		if (!validateLift(set)) return;
		await patchSet(ei, si, { completed: true }, { afterComplete: true });
	}

	async function onToggleComplete(ei: number, si: number) {
		const set = session?.exercises[ei]?.sets[si];
		if (!set) return;
		if (set.completed) {
			await patchSet(ei, si, { completed: false });
			await setRestFromSec(0);
			return;
		}
		await onComplete(ei, si);
	}

	async function onToggleAllComplete(ei: number) {
		if (!session) return;
		const exercise = session.exercises[ei];
		if (!exercise?.sets.length) return;
		if (exercise.sets.every((s) => s.completed)) {
			let next = session;
			for (let si = 0; si < exercise.sets.length; si += 1) {
				next = updateLoggedSet(next, ei, si, { completed: false });
			}
			await persist(next, null);
			return;
		}
		let next = session;
		for (let si = 0; si < exercise.sets.length; si += 1) {
			const row = drafts[si];
			if (row) {
				const weightFiltered = filterWeightInput(row.weight);
				const repsFiltered = filterRepsInput(row.reps, LIVE_REPS);
				next = updateLoggedSet(next, ei, si, {
					weightKg: weightFiltered ? coerceWeightKg(weightFiltered) : null,
					reps: repsFiltered ? coerceReps(repsFiltered, LIVE_REPS) : null
				});
			}
			const set = next.exercises[ei]?.sets[si];
			if (!set || set.completed) continue;
			if (!validateLift(set)) {
				await persist(next, restUntil);
				return;
			}
		}
		const openIndexes = exercise.sets
			.map((s, si) => (s.completed ? -1 : si))
			.filter((si) => si >= 0);
		for (const si of openIndexes) {
			next = updateLoggedSet(next, ei, si, { completed: true });
		}
		const lastSi = openIndexes[openIndexes.length - 1] ?? 0;
		const sec = restSecAfterSet(next, ei, lastSi);
		if (sec > 0) unlockRestAudioFromGesture();
		const nextRest = sec > 0 ? Date.now() + sec * 1000 : null;
		await persist(next, nextRest);
		tapLight();
		await noteChecklist('setLogged');
		setSelectedEi(nextFocusAfterSetComplete(next, ei, lastSi));
		if (isSessionFullyLogged(next)) {
			await setRestFromSec(0);
			offerFinish(next);
		}
	}

	async function commitFinish(current: WorkoutSession) {
		if (finishing) return;
		setFinishing(true);
		const done = finishSession(current);
		if (completedSetCount(done) === 0) {
			await writeActiveSession(null);
			await writeRestUntil(null);
			setFinishing(false);
			router.replace('/');
			return;
		}
		await sessionsRepo.save(done);
		const fromSession = recordsFromFinishedSession(done);
		const existing = await recordsRepo.list();
		const newPrCount = countImprovedRecords(existing, fromSession);
		const mergedRecords = mergeSessionRecordsInto(existing, fromSession);
		await kvSetJson(RECORDS_STORAGE_KEY, mergedRecords);
		await writeActiveSession(null);
		await writeRestUntil(null);
		const allSessions = await sessionsRepo.list();
		const questApply = await noteFinishedSession(done, allSessions);
		await noteFinishedSessionAchievements({
			justFinished: done,
			finishedSessions: allSessions,
			questGoalJustMet: Boolean(questApply?.goalJustMet),
			newPrCount
		});
		if (done.finishedAt && (await isHealthReadEnabled())) {
			const health = getHealthAdapter();
			if (health.isAvailable()) {
				const status = await health.getPermissionStatus();
				if (status === 'not_determined') await health.requestReadPermission();
				const snap = await health.readWorkoutWindow({
					startedAt: done.startedAt,
					finishedAt: done.finishedAt
				});
				if (snap) await saveLastHealthSnapshot(done.id, snap);
			}
		}
		await noteChecklist('sessionFinished');
		if (done.planId) {
			const plans = await plansRepo.list();
			await advanceHomeNextAfterFinish(done.planId, plans);
			await movePlanToEnd(
				done.planId,
				plans.map((p) => p.id)
			);
		}
		try {
			await pushSession(done);
			if (done.planId) {
				const plan = await plansRepo.get(done.planId);
				if (plan) await pushPlan(plan);
			}
			for (const rec of fromSession) {
				const kept = mergedRecords.find((r) => r.exerciseId === rec.exerciseId);
				if (kept) await pushRecord(kept);
			}
		} catch {
			/* offline */
		}
		setFinishing(false);
		router.replace(`/summary/${done.id}`);
	}

	function confirmFinish() {
		if (!session) return;
		setConfirm({
			title: tt('live.finish'),
			message: tt('live.confirmFinish'),
			actions: [{ label: tt('live.finish'), onPress: () => void commitFinish(session) }]
		});
	}

	function offerSkip() {
		if (!session || !ex) return;
		const ei = selectedEi;
		const snapshot = session;
		setConfirm({
			title: tt('live.skipExercise'),
			message: tt('live.skipExerciseHint'),
			actions: [
				{
					label: tt('live.skipExercise'),
					variant: 'danger',
					onPress: () => {
						void (async () => {
							const next = skipSessionExercise(snapshot, ei);
							await persist(next, null);
							if (next.exercises.length === 0) {
								await writeActiveSession(null);
								router.replace('/');
								return;
							}
							setSelectedEi(pickDefaultExerciseIndex(next));
							setForceAltPick(false);
						})();
					}
				}
			]
		});
	}

	function offerDiscard() {
		setConfirm({
			title: tt('live.discard'),
			message: tt('live.discardHint'),
			actions: [
				{
					label: tt('live.discardConfirm'),
					variant: 'danger',
					onPress: () => {
						void writeActiveSession(null)
							.then(() => writeRestUntil(null))
							.then(() => router.replace('/'));
					}
				}
			]
		});
	}

	async function undoLastSet() {
		if (!session) return;
		for (let ei = session.exercises.length - 1; ei >= 0; ei -= 1) {
			const exercise = session.exercises[ei];
			if (!exercise || exercise.skipped) continue;
			for (let si = exercise.sets.length - 1; si >= 0; si -= 1) {
				if (!exercise.sets[si]?.completed) continue;
				await patchSet(ei, si, { completed: false });
				setSelectedEi(ei);
				await setRestFromSec(0);
				return;
			}
		}
	}

	function applyLastDraft(si: number, prev: { weightKg: number | null; reps: number | null }) {
		if (!session) return;
		const weight = prev.weightKg != null ? String(prev.weightKg) : '';
		const reps = prev.reps != null ? String(prev.reps) : '';
		setDrafts((rows) => rows.map((r, i) => (i === si ? { weight, reps } : r)));
		void persist(
			updateLoggedSet(session, selectedEi, si, {
				weightKg: prev.weightKg,
				reps: prev.reps
			}),
			restUntil
		);
		tapLight();
	}

	async function onHeroReady(profile: QuestHeroProfile) {
		await saveQuestHeroProfile(profile);
		const plan = heroPlan;
		if (!plan) return;
		await startNew(plan, history);
	}

	if (!bootReady || !session) {
		return (
			<View style={styles.root}>
				<PageSkeleton variant="planPreview" />
				<QuestOnboardingSheet
					visible={heroPlan != null}
					onComplete={(profile) => void onHeroReady(profile)}
					onDismiss={() => {
						const plan = heroPlan;
						setHeroPlan(null);
						if (plan) void beginSession(plan, history);
						else router.replace('/');
					}}
				/>
				<ConfirmSheet
					open={Boolean(confirm)}
					title={confirm?.title ?? ''}
					message={confirm?.message}
					actions={confirm?.actions ?? []}
					showCancel={confirm?.showCancel !== false}
					onDismiss={() => setConfirm(null)}
				/>
			</View>
		);
	}

	const progress = `${completedSetCount(session)} / ${totalSetCount(session)}`;
	const altOptions =
		needsAlt && ex?.altGroupId
			? session.exercises.filter((e) => e.altGroupId === ex.altGroupId)
			: [];
	const currentComplete = ex ? exerciseAllSetsDone(session.exercises, selectedEi) : false;
	const hasNextExercise = nextManualExerciseFocus(session, selectedEi) !== selectedEi;
	const restTotalSec = ex ? Math.max(1, restSecAfterSet(session, selectedEi)) : 1;
	const currentSetIndex = ex?.sets.findIndex((set) => !set.completed) ?? -1;

	return (
		<KeyboardAvoidingView
			style={styles.root}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			keyboardVerticalOffset={Platform.OS === 'ios' ? headerOffset : 0}
		>
			<View style={styles.header}>
				<Text style={styles.plan} numberOfLines={1}>
					{session.planName}
				</Text>
				<Text style={styles.progress}>
					{progress} · <ElapsedClock startedAt={session.startedAt} />
				</Text>
			</View>

			<FlatList
				horizontal
				style={styles.navList}
				data={visible}
				keyExtractor={(i) => String(i)}
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.nav}
				renderItem={({ item: ei }) => {
					const row = session.exercises[ei];
					if (!row) return null;
					const active = ei === selectedEi;
					return (
						<View style={[styles.navChipWrap, exerciseAllSetsDone(session.exercises, ei) && styles.navChipDone]}>
							<Chip
								label={exerciseDisplayName(row.exerciseId, locale)}
								selected={active}
								onPress={() => {
									setSelectedEi(ei);
									setForceAltPick(false);
								}}
							/>
						</View>
					);
				}}
			/>

			<ScrollView
				style={styles.flex}
				contentContainerStyle={styles.scroll}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag"
			>
				{restUntil != null ? (
					<RestTimer
						restUntil={restUntil}
						totalSec={restTotalSec}
						onAdjust={adjustRest}
						onSkip={() => void setRestFromSec(0)}
						onDone={finishRest}
					/>
				) : null}

				{needsAlt && ex ? (
					<Panel style={styles.card}>
						<Text style={styles.exName}>{tt('live.pickAlt')}</Text>
						{altOptions.map((opt) => (
							<PrimaryButton
								key={opt.exerciseId}
								label={exerciseDisplayName(opt.exerciseId, locale)}
								variant="ghost"
								onPress={() => {
									if (!ex.altGroupId) return;
									void persist(
										chooseAltExercise(session, ex.altGroupId, opt.exerciseId),
										restUntil
									).then(() => setForceAltPick(false));
								}}
							/>
						))}
					</Panel>
				) : ex ? (
					<Panel style={styles.card}>
						<Pressable onPress={() => router.push(`/exercise/${ex.exerciseId}`)}>
							<Text style={styles.exName} numberOfLines={2}>
								{exerciseDisplayName(ex.exerciseId, locale)}
							</Text>
						</Pressable>
						<View style={styles.exActions}>
							<PrimaryButton
								label={tt('exercise.technique')}
								variant="ghost"
								onPress={() => setTechniqueId(ex.exerciseId)}
							/>
							{ex.altGroupId ? (
								<PrimaryButton
									label={tt('live.swapAlternative')}
									variant="ghost"
									onPress={() => setForceAltPick(true)}
								/>
							) : null}
						</View>
						<WeightCue session={session} exerciseId={ex.exerciseId} history={history} />

						{ex.sets.map((set, si) => {
							const prev = previousSetAtIndex(history, ex.exerciseId, si);
							const draft = drafts[si] ?? { weight: '', reps: '' };
							return (
								<LiveSetRow
									key={si}
									setIndex={si}
									completed={set.completed}
									current={si === currentSetIndex}
									skipLift={skipLift}
									bodyweight={bodyweight}
									canRemove={ex.sets.length > 1}
									showKindBadge={loggedSetKind(set) !== 'work'}
									kindLabel={tt(setKindMessageKey(loggedSetKind(set)))}
									draft={draft}
									prev={prev}
									onChangeWeight={(value) => {
										const filtered = filterWeightInput(value, draft.weight);
										setDrafts((rows) =>
											rows.map((r, i) => (i === si ? { ...r, weight: filtered } : r))
										);
									}}
									onChangeReps={(value) => {
										const filtered = filterRepsInput(value, LIVE_REPS, draft.reps);
										setDrafts((rows) =>
											rows.map((r, i) => (i === si ? { ...r, reps: filtered } : r))
										);
									}}
									onBlur={() => void syncDraftToSession(selectedEi, si)}
									onApplyLast={() => {
										if (prev) applyLastDraft(si, prev);
									}}
									onToggleKind={() =>
										void patchSet(selectedEi, si, {
											kind: nextSetKind(loggedSetKind(set))
										})
									}
									onToggleComplete={() => void onToggleComplete(selectedEi, si)}
									onRemove={() =>
										setConfirm({
											title: tt('live.removeSet'),
											actions: [
												{
													label: tt('live.removeSet'),
													variant: 'danger',
													onPress: () =>
														void persist(
															removeLoggedSet(session, selectedEi, si),
															restUntil
														)
												}
											]
										})
									}
								/>
							);
						})}

						<TextInput
							style={styles.note}
							value={noteText}
							onChangeText={setNoteText}
							onBlur={() => {
								if (noteText.trim() === (ex.note ?? '')) return;
								void persist(updateExerciseNote(session, selectedEi, noteText), restUntil);
							}}
							placeholder={tt('live.note')}
							placeholderTextColor={colors.muted}
						/>

						<PrimaryButton
							label={
								currentComplete ? tt('live.unmarkAllSets') : tt('live.markAllSets')
							}
							variant="ghost"
							onPress={() => void onToggleAllComplete(selectedEi)}
						/>
						<PrimaryButton
							label={tt('live.fillWeight')}
							variant="ghost"
							onPress={() => {
								const open = drafts.find((_, i) => !ex.sets[i]?.completed);
								const w = Number(open?.weight);
								if (!Number.isFinite(w)) return;
								void persist(applyWeightToOpenSets(session, selectedEi, w), restUntil);
							}}
						/>
						<PrimaryButton
							label={tt('live.fillReps')}
							variant="ghost"
							onPress={() => {
								const open = drafts.find((_, i) => !ex.sets[i]?.completed);
								const r = Number(open?.reps);
								if (!Number.isFinite(r)) return;
								void persist(applyRepsToOpenSets(session, selectedEi, r), restUntil);
							}}
						/>
						<PrimaryButton
							label={tt('live.addSet')}
							variant="ghost"
							onPress={() => void persist(addLoggedSet(session, selectedEi), restUntil)}
						/>
						<PrimaryButton label={tt('live.skipExercise')} variant="ghost" onPress={offerSkip} />
					</Panel>
				) : (
					<Panel style={styles.card}>
						<Text style={styles.exName}>{tt('live.finishOfferReady')}</Text>
					</Panel>
				)}
			</ScrollView>

			<View style={[styles.footer, { paddingBottom: bottomPad }]}>
				{currentComplete && hasNextExercise ? (
					<PrimaryButton
						label={tt('live.nextExercise')}
						onPress={() => setSelectedEi(nextManualExerciseFocus(session, selectedEi))}
					/>
				) : null}
				<PrimaryButton
					label={finishing ? '…' : tt('live.finish')}
					onPress={confirmFinish}
					disabled={finishing}
				/>
				<View style={styles.footerRow}>
					{completedSetCount(session) > 0 ? (
						<View style={styles.flex}>
							<PrimaryButton
								label={tt('live.undoSet')}
								variant="ghost"
								compact
								onPress={() => void undoLastSet()}
							/>
						</View>
					) : null}
					<View style={styles.flex}>
						<Pressable style={styles.discard} onPress={offerDiscard}>
							<Text style={styles.discardText}>{tt('live.discard')}</Text>
						</Pressable>
					</View>
				</View>
			</View>
			<TechniqueSheet exerciseId={techniqueId} onClose={() => setTechniqueId(null)} />
			<ConfirmSheet
				open={Boolean(confirm)}
				title={confirm?.title ?? ''}
				message={confirm?.message}
				actions={confirm?.actions ?? []}
				showCancel={confirm?.showCancel !== false}
				onDismiss={() => setConfirm(null)}
			/>
		</KeyboardAvoidingView>
	);
}

function WeightCue({
	session,
	exerciseId,
	history
}: {
	session: WorkoutSession;
	exerciseId: string;
	history: readonly WorkoutSession[];
}) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const weeks = exerciseWeightByWeek(history, exerciseId);
	const max = Math.max(1, ...weeks.map((week) => week.weightKg ?? 0));
	const current = exerciseBestWeightKg(session, exerciseId);
	const raised = weightAboveLast(current, history, exerciseId, session.id);
	const hint = nextWeightHint(history, exerciseId);
	return (
		<View style={{ gap: 4, marginBottom: 8 }}>
			<Text
				style={{
					color: colors.muted,
					fontSize: 11,
					fontWeight: '700',
					textTransform: 'uppercase',
					letterSpacing: 0.4
				}}
			>
				{tt('quest.weightByWeek')}
			</Text>
			<View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 40, gap: 4 }}>
				{weeks.map((week) => (
					<View key={week.weekKey} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
						<View
							style={{
								height: week.weightKg == null ? 2 : Math.max(8, Math.round((week.weightKg / max) * 36)),
								borderTopLeftRadius: 4,
								borderTopRightRadius: 4,
								backgroundColor: colors.xp,
								opacity: week.weightKg == null ? 0.28 : 0.9
							}}
						/>
					</View>
				))}
			</View>
			{raised ? (
				<Text style={{ color: colors.xp, fontWeight: '700' }}>
					{tt('quest.weightUpChip', { xp: String(XP_WEIGHT_UP) })}
				</Text>
			) : null}
			{hint ? (
				<Text style={{ color: colors.muted }}>
					{tt('quest.nextHint', { weight: String(hint.weightKg), reps: String(hint.reps) })}
				</Text>
			) : null}
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		flex: { flex: 1 },
		header: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: 2 },
		scroll: { padding: space.lg, gap: space.md },
		center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
		plan: { color: colors.text, fontSize: 22, fontWeight: '800', fontFamily: fontFamily.extrabold },
		progress: { color: colors.muted, fontSize: 14, fontWeight: '600', fontFamily: fontFamily.semibold },
		muted: { color: colors.muted },
		navList: { flexGrow: 0, height: touchMin + space.sm * 2 },
		nav: { paddingHorizontal: space.md, alignItems: 'center', gap: space.sm },
		navChipWrap: { maxWidth: 168, marginRight: space.sm },
		navChipDone: { opacity: 0.65 },
		restBox: {
			backgroundColor: colors.panelRaised,
			borderRadius: radius.lg,
			padding: space.lg,
			alignItems: 'center',
			gap: space.sm,
			borderWidth: 1,
			borderColor: colors.accent
		},
		restLabel: {
			color: colors.muted,
			fontWeight: '700',
			letterSpacing: 0.6,
			textTransform: 'uppercase',
			fontSize: 12,
			fontFamily: fontFamily.bold
		},
		restValue: {
			color: colors.accent,
			fontSize: 48,
			fontWeight: '800',
			fontVariant: ['tabular-nums'],
			lineHeight: 52,
			fontFamily: fontFamily.extrabold
		},
		restUnit: { color: colors.muted, fontWeight: '600', marginTop: -6, fontFamily: fontFamily.semibold },
		restBarTrack: {
			alignSelf: 'stretch',
			height: 8,
			borderRadius: 999,
			backgroundColor: colors.bg,
			overflow: 'hidden',
			marginTop: space.xs
		},
		restBarFill: { height: '100%', backgroundColor: colors.accent },
		restActions: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch', marginTop: space.sm },
		restAction: { flex: 1 },
		card: {
			gap: space.md
		},
		exName: { color: colors.text, fontSize: 22, fontWeight: '800', fontFamily: fontFamily.extrabold },
		exActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
		setRow: {
			gap: space.sm,
			paddingVertical: space.md,
			borderTopWidth: 1,
			borderTopColor: colors.border
		},
		setRowDone: { opacity: 0.72 },
		setHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
		setIndex: { color: colors.text, fontWeight: '700', fontFamily: fontFamily.bold },
		prev: { color: colors.muted, fontSize: 13, flexShrink: 1, textAlign: 'right' },
		inputs: { flexDirection: 'row', gap: space.sm },
		input: {
			flex: 1,
			minHeight: 56,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			backgroundColor: colors.bg,
			color: colors.text,
			paddingHorizontal: space.md,
			fontSize: 22,
			fontWeight: '800',
			textAlign: 'center',
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.extrabold
		},
		setActions: { gap: space.sm },
		removeHit: {
			minHeight: touchMin,
			minWidth: touchMin,
			alignItems: 'center',
			justifyContent: 'center'
		},
		removeHint: {
			color: colors.danger,
			fontSize: 12,
			textAlign: 'center',
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		note: {
			minHeight: touchMin,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.bg,
			color: colors.text,
			paddingHorizontal: space.md,
			fontSize: 15,
			fontFamily: fontFamily.regular
		},
		footer: {
			paddingHorizontal: space.lg,
			paddingTop: space.sm,
			gap: space.sm,
			borderTopWidth: 1,
			borderTopColor: colors.border,
			backgroundColor: colors.bg
		},
		footerRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
		discard: { minHeight: touchMin, alignItems: 'center', justifyContent: 'center' },
		discardText: { color: colors.danger, fontWeight: '600', fontFamily: fontFamily.semibold }
	});
}
