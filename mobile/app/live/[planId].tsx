import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import { RECORDS_STORAGE_KEY } from '@repdraft/domain/repository';
import {
	addLoggedSet,
	altGroupNeedsPick,
	applyWeightToOpenSets,
	chooseAltExercise,
	completedSetCount,
	finishSession,
	lastPerformance,
	loggedSetKind,
	nextSetKind,
	restSecAfterSet,
	seedOpenSetsFromLastPerformance,
	setKindMessageKey,
	skipSessionExercise,
	startSessionFromPlan,
	totalSetCount,
	updateExerciseNote,
	updateLoggedSet
} from '@repdraft/domain/session';
import type { WorkoutSession } from '@repdraft/domain/types';
import { exerciseDisplayName, refreshCustomsCache } from '../../src/catalog/loadIndex';
import { PrimaryButton } from '../../src/components/PrimaryButton';
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
import { pushPlan, pushRecord, pushSession } from '../../src/sync/cloudSync';
import { colors, touchMin } from '../../src/theme';

type Focus = { exerciseIndex: number; setIndex: number };

function findFocus(session: WorkoutSession): Focus | null {
	for (let ei = 0; ei < session.exercises.length; ei += 1) {
		const ex = session.exercises[ei];
		if (!ex || ex.skipped) continue;
		if (altGroupNeedsPick(session, ei)) return { exerciseIndex: ei, setIndex: 0 };
		const choices = session.altChoices ?? {};
		if (ex.altGroupId && choices[ex.altGroupId] && choices[ex.altGroupId] !== ex.exerciseId) {
			continue;
		}
		for (let si = 0; si < ex.sets.length; si += 1) {
			if (!ex.sets[si]?.completed) return { exerciseIndex: ei, setIndex: si };
		}
	}
	return null;
}

export default function LiveScreen() {
	const { planId } = useLocalSearchParams<{ planId: string }>();
	const router = useRouter();
	const { locale, tt } = useLocale();
	const [session, setSession] = useState<WorkoutSession | null>(null);
	const [history, setHistory] = useState<WorkoutSession[]>([]);
	const [weightText, setWeightText] = useState('');
	const [repsText, setRepsText] = useState('');
	const [noteText, setNoteText] = useState('');
	const [restLeft, setRestLeft] = useState<number | null>(null);
	const [finishing, setFinishing] = useState(false);

	const persist = useCallback(async (next: WorkoutSession) => {
		setSession(next);
		await writeActiveSession(next);
	}, []);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			await refreshCustomsCache();
			await noteChecklist('liveEntered');
			const [active, hist, plan] = await Promise.all([
				readActiveSession(),
				sessionsRepo.list(),
				planId ? plansRepo.get(planId) : Promise.resolve(null)
			]);
			if (cancelled) return;
			setHistory(hist);
			if (active && !active.finishedAt && (!planId || active.planId === planId)) {
				setSession(active);
				return;
			}
			if (plan) {
				let started = startSessionFromPlan(plan);
				started = seedOpenSetsFromLastPerformance(started, (exerciseId) =>
					lastPerformance(hist, exerciseId)
				);
				await writeActiveSession(started);
				if (!cancelled) setSession(started);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [planId]);

	const focus = useMemo(() => (session ? findFocus(session) : null), [session]);
	const needsAlt = Boolean(session && focus && altGroupNeedsPick(session, focus.exerciseIndex));

	useEffect(() => {
		if (!session || !focus || needsAlt) {
			setWeightText('');
			setRepsText('');
			setNoteText('');
			return;
		}
		const ex = session.exercises[focus.exerciseIndex];
		const set = ex?.sets[focus.setIndex];
		const prev = lastPerformance(history, ex?.exerciseId ?? '');
		setWeightText(
			set?.weightKg != null
				? String(set.weightKg)
				: prev?.weightKg != null
					? String(prev.weightKg)
					: ''
		);
		setRepsText(
			set?.reps != null
				? String(set.reps)
				: prev?.reps != null
					? String(prev.reps)
					: String(ex?.targetReps ?? '')
		);
		setNoteText(ex?.note ?? '');
	}, [session, focus, history, needsAlt]);

	useEffect(() => {
		if (restLeft == null || restLeft <= 0) return;
		const t = setTimeout(() => setRestLeft((v) => (v == null ? null : v - 1)), 1000);
		return () => clearTimeout(t);
	}, [restLeft]);

	async function confirmSet() {
		if (!session || !focus || needsAlt) return;
		const weightKg = weightText.trim() === '' ? null : Number(weightText);
		const reps = repsText.trim() === '' ? null : Number(repsText);
		let patched = updateLoggedSet(session, focus.exerciseIndex, focus.setIndex, {
			weightKg: Number.isFinite(weightKg as number) ? (weightKg as number) : null,
			reps: Number.isFinite(reps as number) ? (reps as number) : null,
			completed: true
		});
		if (noteText.trim() !== (session.exercises[focus.exerciseIndex]?.note ?? '')) {
			patched = updateExerciseNote(patched, focus.exerciseIndex, noteText);
		}
		await persist(patched);
		await noteChecklist('setLogged');
		const rest = restSecAfterSet(patched, focus.exerciseIndex, focus.setIndex);
		if (rest > 0 && findFocus(patched)) setRestLeft(rest);
		else setRestLeft(null);
	}

	function offerSkip() {
		if (!session || !focus) return;
		const ei = focus.exerciseIndex;
		const snapshot = session;
		Alert.alert(tt('live.skipExercise'), tt('live.skipExerciseHint'), [
			{ text: tt('common.cancel'), style: 'cancel' },
			{
				text: tt('live.skipExercise'),
				style: 'destructive',
				onPress: () => {
					void persist(skipSessionExercise(snapshot, ei)).then(() => setRestLeft(null));
				}
			}
		]);
	}

	async function undoLastSet() {
		if (!session) return;
		for (let ei = session.exercises.length - 1; ei >= 0; ei -= 1) {
			const ex = session.exercises[ei];
			if (!ex || ex.skipped) continue;
			for (let si = ex.sets.length - 1; si >= 0; si -= 1) {
				if (!ex.sets[si]?.completed) continue;
				await persist(updateLoggedSet(session, ei, si, { completed: false }));
				setRestLeft(null);
				return;
			}
		}
	}

	async function finish() {
		if (!session || finishing) return;
		setFinishing(true);
		const done = finishSession(session);
		if (completedSetCount(done) === 0) {
			await writeActiveSession(null);
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
		await noteFinishedSession(done);
		await noteChecklist('sessionFinished');
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

	if (!session) {
		return (
			<View style={styles.center}>
				<Text style={styles.muted}>…</Text>
			</View>
		);
	}

	const progress = `${completedSetCount(session)} / ${totalSetCount(session)}`;
	const ex = focus ? session.exercises[focus.exerciseIndex] : null;
	const prev = ex ? lastPerformance(history, ex.exerciseId) : null;
	const altOptions =
		needsAlt && ex?.altGroupId
			? session.exercises.filter((e) => e.altGroupId === ex.altGroupId)
			: [];

	const kindKey = focus && ex?.sets[focus.setIndex]
		? setKindMessageKey(loggedSetKind(ex.sets[focus.setIndex]!))
		: 'live.setKindWork';

	function offerDiscard() {
		Alert.alert(tt('live.discard'), tt('live.discardHint'), [
			{ text: tt('common.cancel'), style: 'cancel' },
			{
				text: tt('live.discardConfirm'),
				style: 'destructive',
				onPress: () => {
					void writeActiveSession(null).then(() => router.replace('/'));
				}
			}
		]);
	}

	return (
		<KeyboardAvoidingView
			style={styles.root}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			keyboardVerticalOffset={88}
		>
			<ScrollView
				contentContainerStyle={styles.scroll}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag"
			>
				<Text style={styles.plan}>{session.planName}</Text>
				<Text style={styles.progress}>{progress}</Text>

				{restLeft != null && restLeft > 0 ? (
					<View style={styles.restBox}>
						<Text style={styles.restLabel}>{tt('live.rest')}</Text>
						<Text style={styles.restValue}>{restLeft}s</Text>
						<PrimaryButton
							label={tt('live.skipRest')}
							variant="ghost"
							onPress={() => setRestLeft(null)}
						/>
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
									void persist(chooseAltExercise(session, ex.altGroupId, opt.exerciseId));
								}}
							/>
						))}
					</View>
				) : focus && ex ? (
					<View style={styles.card}>
						<Pressable onPress={() => router.push(`/exercise/${ex.exerciseId}`)}>
							<Text style={styles.exName}>{exerciseDisplayName(ex.exerciseId, locale)}</Text>
						</Pressable>
						<Text style={styles.setLabel}>
							{tt('live.setProgress', { n: focus.setIndex + 1, total: ex.sets.length })}
						</Text>
						<Text style={styles.prev}>
							{tt('live.last')}:{' '}
							{prev
								? `${prev.weightKg ?? '-'} ${tt('common.kg')} × ${prev.reps ?? '-'}`
								: '-'}
						</Text>
						<View style={styles.inputs}>
							<View style={styles.field}>
								<Text style={styles.fieldLabel}>{tt('common.kg')}</Text>
								<View style={styles.stepRow}>
									<Pressable
										style={styles.stepBtn}
										onPress={() => {
											const n = Number(weightText);
											const base = Number.isFinite(n) ? n : 0;
											setWeightText(String(Math.max(0, base - 2.5)));
										}}
									>
										<Text style={styles.stepBtnText}>-</Text>
									</Pressable>
									<TextInput
										value={weightText}
										onChangeText={setWeightText}
										keyboardType="decimal-pad"
										style={styles.input}
										placeholderTextColor={colors.muted}
									/>
									<Pressable
										style={styles.stepBtn}
										onPress={() => {
											const n = Number(weightText);
											const base = Number.isFinite(n) ? n : 0;
											setWeightText(String(base + 2.5));
										}}
									>
										<Text style={styles.stepBtnText}>+</Text>
									</Pressable>
								</View>
							</View>
							<View style={styles.field}>
								<Text style={styles.fieldLabel}>{tt('common.reps')}</Text>
								<View style={styles.stepRow}>
									<Pressable
										style={styles.stepBtn}
										onPress={() => {
											const n = Number(repsText);
											const base = Number.isFinite(n) ? n : 0;
											setRepsText(String(Math.max(0, base - 1)));
										}}
									>
										<Text style={styles.stepBtnText}>-</Text>
									</Pressable>
									<TextInput
										value={repsText}
										onChangeText={setRepsText}
										keyboardType="number-pad"
										style={styles.input}
										placeholderTextColor={colors.muted}
									/>
									<Pressable
										style={styles.stepBtn}
										onPress={() => {
											const n = Number(repsText);
											const base = Number.isFinite(n) ? n : 0;
											setRepsText(String(base + 1));
										}}
									>
										<Text style={styles.stepBtnText}>+</Text>
									</Pressable>
								</View>
							</View>
						</View>
						<TextInput
							style={styles.note}
							value={noteText}
							onChangeText={setNoteText}
							placeholder={tt('live.note')}
							placeholderTextColor={colors.muted}
						/>
						<PrimaryButton
							label={`${tt('live.setKind')}: ${tt(kindKey)}`}
							variant="ghost"
							onPress={() => {
								const cur = ex.sets[focus.setIndex];
								if (!cur) return;
								void persist(
									updateLoggedSet(session, focus.exerciseIndex, focus.setIndex, {
										kind: nextSetKind(loggedSetKind(cur))
									})
								);
							}}
						/>
						<PrimaryButton label={tt('live.log')} onPress={() => void confirmSet()} />
						<PrimaryButton
							label={tt('live.fillWeight')}
							variant="ghost"
							onPress={() => {
								const w = Number(weightText);
								if (!Number.isFinite(w)) return;
								void persist(applyWeightToOpenSets(session, focus.exerciseIndex, w));
							}}
						/>
						<PrimaryButton
							label={tt('live.addSet')}
							variant="ghost"
							onPress={() => void persist(addLoggedSet(session, focus.exerciseIndex))}
						/>
						<PrimaryButton label={tt('live.skipExercise')} variant="ghost" onPress={offerSkip} />
					</View>
				) : (
					<View style={styles.card}>
						<Text style={styles.exName}>{tt('live.finish')}</Text>
					</View>
				)}
			</ScrollView>

			<View style={styles.footer}>
				{completedSetCount(session) > 0 ? (
					<PrimaryButton
						label={tt('live.undoSet')}
						variant="ghost"
						onPress={() => void undoLastSet()}
					/>
				) : null}
				<Pressable style={styles.discard} onPress={offerDiscard}>
					<Text style={styles.discardText}>{tt('live.discard')}</Text>
				</Pressable>
				<PrimaryButton
					label={finishing ? '…' : tt('live.finish')}
					onPress={() => void finish()}
					disabled={finishing}
				/>
			</View>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	scroll: { padding: 16, gap: 12, paddingBottom: 24 },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
	plan: { color: colors.text, fontSize: 20, fontWeight: '800' },
	progress: { color: colors.muted },
	muted: { color: colors.muted },
	restBox: {
		backgroundColor: colors.panel,
		borderRadius: 14,
		padding: 16,
		alignItems: 'center',
		gap: 8,
		borderWidth: 1,
		borderColor: colors.border
	},
	restLabel: { color: colors.muted, fontWeight: '600' },
	restValue: {
		color: colors.accent,
		fontSize: 40,
		fontWeight: '800',
		fontVariant: ['tabular-nums']
	},
	card: {
		backgroundColor: colors.panel,
		borderRadius: 16,
		padding: 16,
		gap: 10,
		borderWidth: 1,
		borderColor: colors.border
	},
	exName: { color: colors.text, fontSize: 22, fontWeight: '800' },
	setLabel: { color: colors.muted },
	prev: { color: colors.muted, fontSize: 14 },
	inputs: { flexDirection: 'column', gap: 12 },
	field: { gap: 6 },
	fieldLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
	stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	stepBtn: {
		minWidth: touchMin,
		minHeight: touchMin,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.bg,
		alignItems: 'center',
		justifyContent: 'center'
	},
	stepBtnText: { color: colors.text, fontSize: 22, fontWeight: '700' },
	input: {
		flex: 1,
		minHeight: touchMin,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.bg,
		color: colors.text,
		paddingHorizontal: 14,
		fontSize: 20,
		fontWeight: '700',
		textAlign: 'center',
		fontVariant: ['tabular-nums']
	},
	note: {
		minHeight: touchMin,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.bg,
		color: colors.text,
		paddingHorizontal: 14,
		fontSize: 15
	},
	footer: {
		paddingHorizontal: 16,
		paddingBottom: 16,
		paddingTop: 8,
		gap: 10,
		borderTopWidth: 1,
		borderTopColor: colors.border
	},
	discard: { minHeight: touchMin, alignItems: 'center', justifyContent: 'center' },
	discardText: { color: colors.danger, fontWeight: '600' }
});
