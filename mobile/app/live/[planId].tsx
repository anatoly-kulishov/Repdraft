import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	Alert,
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
	coerceReps,
	coerceWeightKg,
	filterRepsInput,
	filterWeightInput,
	LIVE_REPS
} from '@repdraft/domain/inputLimits';
import { RECORDS_STORAGE_KEY } from '@repdraft/domain/repository';
import {
	addLoggedSet,
	altGroupNeedsPick,
	applyRepsToOpenSets,
	applyWeightToOpenSets,
	chooseAltExercise,
	completedSetCount,
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
import { isCardioBodyPart } from '@repdraft/domain/workout';
import type { LoggedSet, WorkoutPlan, WorkoutSession } from '@repdraft/domain/types';
import { unlockRestAudioFromGesture } from '../../src/audio/restChime';
import { signalRestDone } from '../../src/audio/restDone';
import { exerciseDisplayName, getIndexItem, refreshCustomsCache } from '../../src/catalog/loadIndex';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { TechniqueSheet } from '../../src/components/TechniqueSheet';
import { advanceHomeNextAfterFinish } from '../../src/live/homeNext';
import { movePlanToEnd } from '../../src/live/planOrder';
import { readRestUntil, restSecondsLeft, writeRestUntil } from '../../src/live/restUntil';
import {
	exerciseAllSetsDone,
	formatElapsedClock,
	isLiveResumePlanId,
	pickDefaultExerciseIndex
} from '../../src/live/sessionUi';
import { mergeSessionRecordsInto, recordsFromFinishedSession } from '../../src/lib/sessionRecords';
import { useLocale } from '../../src/state/locale';
import { noteChecklist } from '../../src/state/onboarding';
import { noteFinishedSession } from '../../src/state/quest';
import { kvSetJson } from '../../src/storage/kv';
import { plansRepo } from '../../src/storage/plansRepo';
import { recordsRepo } from '../../src/storage/recordsRepo';
import {
	readActiveSession,
	sessionsRepo,
	writeActiveSession
} from '../../src/storage/sessionsRepo';
import { useBottomChromePad } from '../../src/layout/safe';
import { pushPlan, pushRecord, pushSession } from '../../src/sync/cloudSync';
import { colors, radius, space, touchMin } from '../../src/theme';

function tapLight(): void {
	void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

type DraftRow = { weight: string; reps: string };

export default function LiveScreen() {
	const { planId: planIdParam } = useLocalSearchParams<{ planId: string }>();
	const planId = Array.isArray(planIdParam) ? planIdParam[0] : planIdParam;
	const router = useRouter();
	const { locale, tt } = useLocale();
	const bottomPad = useBottomChromePad(space.md);

	const [session, setSession] = useState<WorkoutSession | null>(null);
	const [history, setHistory] = useState<WorkoutSession[]>([]);
	const [selectedEi, setSelectedEi] = useState(0);
	const [drafts, setDrafts] = useState<DraftRow[]>([]);
	const [noteText, setNoteText] = useState('');
	const [restUntil, setRestUntil] = useState<number | null>(null);
	const [now, setNow] = useState(Date.now());
	const [finishing, setFinishing] = useState(false);
	const [bootReady, setBootReady] = useState(false);
	const [forceAltPick, setForceAltPick] = useState(false);
	const [techniqueId, setTechniqueId] = useState<string | null>(null);
	const finishOfferedRef = useRef(false);
	const prevRestLeft = useRef(0);
	const restChimeArmed = useRef(false);

	const persist = useCallback(async (next: WorkoutSession, nextRest: number | null = restUntil) => {
		setSession(next);
		await writeActiveSession(next);
		await writeRestUntil(nextRest);
		setRestUntil(nextRest);
	}, [restUntil]);

	const startNew = useCallback(
		async (plan: WorkoutPlan, hist: WorkoutSession[]) => {
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
			setHistory(hist);
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
					Alert.alert(tt('live.switchStartNew'), tt('live.switchOfferHint'), [
						{
							text: tt('live.switchKeepCurrent'),
							style: 'cancel',
							onPress: () => {
								router.replace(`/live/${active.planId}`);
							}
						},
						{
							text: tt('live.switchStartNew'),
							style: 'destructive',
							onPress: () => {
								void startNew(plan, hist).then(() => {
									if (!cancelled) setBootReady(true);
								});
							}
						}
					]);
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
			await startNew(plan, hist);
			if (!cancelled) setBootReady(true);
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- boot once per planId
	}, [planId]);

	useEffect(() => {
		const t = setInterval(() => setNow(Date.now()), 250);
		return () => clearInterval(t);
	}, []);

	useEffect(() => {
		void activateKeepAwakeAsync('live-session');
		return () => {
			void deactivateKeepAwake('live-session');
		};
	}, []);

	useEffect(() => {
		const left = restSecondsLeft(restUntil, now);
		if (restUntil != null && left > 0) restChimeArmed.current = true;
		if (prevRestLeft.current > 0 && left === 0 && restChimeArmed.current) {
			restChimeArmed.current = false;
			void signalRestDone();
			void writeRestUntil(null).then(() => setRestUntil(null));
		}
		prevRestLeft.current = left;
	}, [now, restUntil]);

	const visible = useMemo(
		() => (session ? visibleSessionExerciseIndices(session) : []),
		[session]
	);
	const ex = session?.exercises[selectedEi] ?? null;
	const needsAlt = Boolean(
		session && ex && (forceAltPick || altGroupNeedsPick(session, selectedEi))
	);
	const restLeft = restSecondsLeft(restUntil, now);
	const skipLift = Boolean(ex && isCardioBodyPart(getIndexItem(ex.exerciseId)?.body_part));

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
		Alert.alert(tt('live.finishOfferReady'), tt('live.finishOfferHint'), [
			{
				text: tt('live.finishOfferLater'),
				style: 'cancel',
				onPress: () => {
					finishOfferedRef.current = false;
				}
			},
			{ text: tt('live.finish'), onPress: () => void commitFinish(current) }
		]);
	}

	async function setRestFromSec(sec: number) {
		if (sec > 0) unlockRestAudioFromGesture();
		const next = sec > 0 ? Date.now() + sec * 1000 : null;
		if (next == null) restChimeArmed.current = false;
		await writeRestUntil(next);
		setRestUntil(next);
	}

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
			Alert.alert(tt('live.invalidWeight'));
			return false;
		}
		if (
			set.reps == null ||
			!Number.isInteger(set.reps) ||
			set.reps < LIVE_REPS.min ||
			set.reps > LIVE_REPS.max
		) {
			Alert.alert(tt('live.invalidReps'));
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
		const mergedRecords = mergeSessionRecordsInto(existing, fromSession);
		await kvSetJson(RECORDS_STORAGE_KEY, mergedRecords);
		await writeActiveSession(null);
		await writeRestUntil(null);
		await noteFinishedSession(done);
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
		Alert.alert(tt('live.finish'), tt('live.confirmFinish'), [
			{ text: tt('common.cancel'), style: 'cancel' },
			{ text: tt('live.finish'), onPress: () => void commitFinish(session) }
		]);
	}

	function offerSkip() {
		if (!session || !ex) return;
		const ei = selectedEi;
		const snapshot = session;
		Alert.alert(tt('live.skipExercise'), tt('live.skipExerciseHint'), [
			{ text: tt('common.cancel'), style: 'cancel' },
			{
				text: tt('live.skipExercise'),
				style: 'destructive',
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
		]);
	}

	function offerDiscard() {
		Alert.alert(tt('live.discard'), tt('live.discardHint'), [
			{ text: tt('common.cancel'), style: 'cancel' },
			{
				text: tt('live.discardConfirm'),
				style: 'destructive',
				onPress: () => {
					void writeActiveSession(null).then(() => writeRestUntil(null)).then(() => router.replace('/'));
				}
			}
		]);
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

	if (!bootReady || !session) {
		return (
			<View style={styles.center}>
				<Text style={styles.muted}>…</Text>
			</View>
		);
	}

	const progress = `${completedSetCount(session)} / ${totalSetCount(session)}`;
	const elapsed = formatElapsedClock(now - new Date(session.startedAt).getTime());
	const altOptions =
		needsAlt && ex?.altGroupId
			? session.exercises.filter((e) => e.altGroupId === ex.altGroupId)
			: [];
	const currentComplete = ex ? exerciseAllSetsDone(session.exercises, selectedEi) : false;
	const hasNextExercise = nextManualExerciseFocus(session, selectedEi) !== selectedEi;
	const restTotalSec = ex ? Math.max(1, restSecAfterSet(session, selectedEi)) : 1;
	const restPct = restLeft > 0 ? Math.min(1, restLeft / restTotalSec) : 0;

	return (
		<KeyboardAvoidingView
			style={styles.root}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			keyboardVerticalOffset={88}
		>
			<View style={styles.header}>
				<Text style={styles.plan} numberOfLines={1}>
					{session.planName}
				</Text>
				<Text style={styles.progress}>
					{progress} · {elapsed}
				</Text>
			</View>

			<FlatList
				horizontal
				data={visible}
				keyExtractor={(i) => String(i)}
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.nav}
				renderItem={({ item: ei }) => {
					const row = session.exercises[ei];
					if (!row) return null;
					const done = exerciseAllSetsDone(session.exercises, ei);
					const active = ei === selectedEi;
					return (
						<Pressable
							style={[styles.navChip, active && styles.navChipActive, done && styles.navChipDone]}
							onPress={() => {
								setSelectedEi(ei);
								setForceAltPick(false);
							}}
						>
							<Text style={[styles.navChipText, active && styles.navChipTextActive]} numberOfLines={1}>
								{exerciseDisplayName(row.exerciseId, locale)}
							</Text>
						</Pressable>
					);
				}}
			/>

			<ScrollView
				style={styles.flex}
				contentContainerStyle={styles.scroll}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag"
			>
				{restLeft > 0 ? (
					<View style={styles.restBox}>
						<Text style={styles.restLabel}>{tt('live.rest')}</Text>
						<Text style={styles.restValue}>{restLeft}</Text>
						<Text style={styles.restUnit}>sec</Text>
						<View style={styles.restBarTrack}>
							<View style={[styles.restBarFill, { width: `${Math.round(restPct * 100)}%` }]} />
						</View>
						<View style={styles.restActions}>
							<View style={styles.restAction}>
								<PrimaryButton
									label={tt('live.restPlus30')}
									variant="ghost"
									compact
									onPress={() => {
										unlockRestAudioFromGesture();
										const base = restUntil && restUntil > Date.now() ? restUntil : Date.now();
										const next = base + 30_000;
										restChimeArmed.current = true;
										void writeRestUntil(next).then(() => setRestUntil(next));
									}}
								/>
							</View>
							<View style={styles.restAction}>
								<PrimaryButton
									label={tt('live.skipRest')}
									variant="ghost"
									compact
									onPress={() => void setRestFromSec(0)}
								/>
							</View>
						</View>
					</View>
				) : null}

				{needsAlt && ex ? (
					<View style={styles.card}>
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
					</View>
				) : ex ? (
					<View style={styles.card}>
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

						{ex.sets.map((set, si) => {
							const prev = previousSetAtIndex(history, ex.exerciseId, si);
							const kindKey = setKindMessageKey(loggedSetKind(set));
							const draft = drafts[si] ?? { weight: '', reps: '' };
							return (
								<View key={si} style={[styles.setRow, set.completed && styles.setRowDone]}>
									<View style={styles.setHead}>
										<Text style={styles.setIndex}>
											{tt('live.setProgress', { n: si + 1, total: ex.sets.length })}
										</Text>
										<Text style={styles.prev}>
											{tt('live.last')}:{' '}
											{prev
												? `${prev.weightKg ?? '-'} × ${prev.reps ?? '-'}`
												: '-'}
										</Text>
									</View>
									<View style={styles.inputs}>
										<TextInput
											value={draft.weight}
											editable={!set.completed && !skipLift}
											onChangeText={(value) => {
												const filtered = filterWeightInput(value, draft.weight);
												setDrafts((rows) =>
													rows.map((r, i) => (i === si ? { ...r, weight: filtered } : r))
												);
											}}
											onBlur={() => void syncDraftToSession(selectedEi, si)}
											keyboardType="decimal-pad"
											style={styles.input}
											placeholder={tt('common.kg')}
											placeholderTextColor={colors.muted}
										/>
										<TextInput
											value={draft.reps}
											editable={!set.completed}
											onChangeText={(value) => {
												const filtered = filterRepsInput(value, LIVE_REPS, draft.reps);
												setDrafts((rows) =>
													rows.map((r, i) => (i === si ? { ...r, reps: filtered } : r))
												);
											}}
											onBlur={() => void syncDraftToSession(selectedEi, si)}
											keyboardType="number-pad"
											style={styles.input}
											placeholder={tt('common.reps')}
											placeholderTextColor={colors.muted}
										/>
									</View>
									<View style={styles.setActions}>
										<PrimaryButton
											label={tt(kindKey)}
											variant="ghost"
											onPress={() =>
												void patchSet(selectedEi, si, {
													kind: nextSetKind(loggedSetKind(set))
												})
											}
										/>
										<PrimaryButton
											label={set.completed ? tt('live.undoSet') : tt('live.log')}
											onPress={() => void onToggleComplete(selectedEi, si)}
										/>
										{ex.sets.length > 1 ? (
											<Pressable
												style={styles.removeHit}
												onLongPress={() => {
													Alert.alert(tt('live.removeSet'), undefined, [
														{ text: tt('common.cancel'), style: 'cancel' },
														{
															text: tt('live.removeSet'),
															style: 'destructive',
															onPress: () =>
																void persist(
																	removeLoggedSet(session, selectedEi, si),
																	restUntil
																)
														}
													]);
												}}
											>
												<Text style={styles.removeHint}>{tt('live.removeSet')}</Text>
											</Pressable>
										) : null}
									</View>
								</View>
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
					</View>
				) : (
					<View style={styles.card}>
						<Text style={styles.exName}>{tt('live.finishOfferReady')}</Text>
					</View>
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
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	flex: { flex: 1 },
	header: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: 2 },
	scroll: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
	plan: { color: colors.text, fontSize: 22, fontWeight: '800' },
	progress: { color: colors.muted, fontSize: 14, fontWeight: '600' },
	muted: { color: colors.muted },
	nav: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm },
	navChip: {
		minHeight: touchMin,
		maxWidth: 168,
		paddingHorizontal: space.md,
		borderRadius: radius.xl,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: space.sm
	},
	navChipActive: {
		borderColor: colors.accent,
		backgroundColor: colors.accentDim
	},
	navChipDone: { opacity: 0.65 },
	navChipText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
	navChipTextActive: { color: colors.text },
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
		fontSize: 12
	},
	restValue: {
		color: colors.accent,
		fontSize: 48,
		fontWeight: '800',
		fontVariant: ['tabular-nums'],
		lineHeight: 52
	},
	restUnit: { color: colors.muted, fontWeight: '600', marginTop: -6 },
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
		backgroundColor: colors.panel,
		borderRadius: radius.lg,
		padding: space.lg,
		gap: space.md,
		borderWidth: 1,
		borderColor: colors.border
	},
	exName: { color: colors.text, fontSize: 22, fontWeight: '800' },
	exActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
	setRow: {
		gap: space.sm,
		paddingVertical: space.md,
		borderTopWidth: 1,
		borderTopColor: colors.border
	},
	setRowDone: { opacity: 0.72 },
	setHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
	setIndex: { color: colors.text, fontWeight: '700' },
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
		fontVariant: ['tabular-nums']
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
		fontWeight: '600'
	},
	note: {
		minHeight: touchMin,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.bg,
		color: colors.text,
		paddingHorizontal: space.md,
		fontSize: 15
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
	discardText: { color: colors.danger, fontWeight: '600' }
});
