import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import {
	addCompletedLoggedSet,
	completedSetCount,
	planDraftFromSession,
	removeLoggedExercise,
	removeLoggedSet,
	sessionDurationMs,
	sessionVolumeKg,
	updateLoggedSet
} from '@repdraft/domain/session';
import type { WorkoutSession } from '@repdraft/domain/types';
import { exerciseDisplayName, getIndexItem, refreshCustomsCache } from '../../src/catalog/loadIndex';
import { CatalogThumb } from '../../src/components/CatalogThumb';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { TechniqueSheet } from '../../src/components/TechniqueSheet';
import { useBottomChromePad } from '../../src/layout/safe';
import { useLocale } from '../../src/state/locale';
import { plansRepo } from '../../src/storage/plansRepo';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { clearSessionTombstone } from '../../src/sync/tombstones';
import { deleteSessionRemote, pushPlan, pushSession } from '../../src/sync/cloudSync';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../../src/theme';

export default function HistoryDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const [session, setSession] = useState<WorkoutSession | null>(null);
	const [editing, setEditing] = useState(false);
	const [undo, setUndo] = useState<WorkoutSession | null>(null);
	const [techniqueId, setTechniqueId] = useState<string | null>(null);
	const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		void (async () => {
			await refreshCustomsCache();
			setSession(id ? await sessionsRepo.get(id) : null);
		})();
	}, [id]);

	useEffect(() => {
		return () => {
			if (undoTimer.current) clearTimeout(undoTimer.current);
		};
	}, []);

	function confirmRemove() {
		if (!session) return;
		Alert.alert(tt('workouts.confirmDeleteSession', { name: session.planName || '-' }), undefined, [
			{ text: tt('common.cancel'), style: 'cancel' },
			{
				text: tt('history.delete'),
				style: 'destructive',
				onPress: () => void remove()
			}
		]);
	}

	async function remove() {
		if (!session) return;
		const snapshot = session;
		await sessionsRepo.remove(snapshot.id);
		try {
			await deleteSessionRemote(snapshot.id);
		} catch {
			/* offline */
		}
		setSession(null);
		setUndo(snapshot);
		if (undoTimer.current) clearTimeout(undoTimer.current);
		undoTimer.current = setTimeout(() => {
			setUndo(null);
			router.replace('/history');
		}, 5000);
	}

	async function restore() {
		if (!undo) return;
		if (undoTimer.current) clearTimeout(undoTimer.current);
		await sessionsRepo.save(undo);
		await clearSessionTombstone(undo.id);
		try {
			await pushSession(undo);
		} catch {
			/* offline */
		}
		setSession(undo);
		setUndo(null);
	}

	async function saveEdits() {
		if (!session) return;
		await sessionsRepo.save(session);
		try {
			await pushSession(session);
		} catch {
			/* offline */
		}
		setEditing(false);
	}

	async function openAsPlan() {
		if (!session) return;
		const draft = planDraftFromSession(session);
		await plansRepo.save(draft);
		try {
			await pushPlan(draft);
		} catch {
			/* offline */
		}
		router.push(`/builder/${draft.id}`);
	}

	if (undo && !session) {
		return (
			<View style={styles.center}>
				<Text style={styles.muted}>{tt('history.deleted')}</Text>
				<Pressable style={styles.undoBtn} onPress={() => void restore()}>
					<Text style={styles.undoText}>{tt('history.undo')}</Text>
				</Pressable>
			</View>
		);
	}

	if (!session) {
		return (
			<View style={styles.center}>
				<Text style={styles.muted}>…</Text>
			</View>
		);
	}

	const ms = sessionDurationMs(session) ?? 0;
	const mins = Math.max(1, Math.round(ms / 60000));
	const dateLabel = new Date(session.finishedAt ?? session.startedAt).toLocaleDateString(
		locale === 'ru' ? 'ru-RU' : 'en-US',
		{ day: 'numeric', month: 'short', year: 'numeric' }
	);
	const volume = sessionVolumeKg(session);

	return (
		<ScrollView contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}>
			<Text style={styles.title} numberOfLines={2}>
				{session.planName || '-'}
			</Text>
			<Text style={styles.meta} numberOfLines={2}>
				{dateLabel} · {mins} {tt('history.min')} · {completedSetCount(session)}{' '}
				{tt('history.setsCount')}
				{volume > 0 ? ` · ${Math.round(volume)} ${tt('common.kg')}` : ''}
			</Text>
				{session.exercises.map((ex, ei) => {
					const done = ex.sets.filter((s) => s.completed);
					if (!editing && done.length === 0) {
						return (
							<View key={`${ex.exerciseId}-${ei}`} style={styles.card}>
								<Text style={styles.cardTitle}>{exerciseDisplayName(ex.exerciseId, locale)}</Text>
								<Text style={styles.setLine}>{tt('workouts.noLoggedSets')}</Text>
							</View>
						);
					}
					const item = getIndexItem(ex.exerciseId);
					const note = ex.note?.trim();
					return (
						<SwipeableRow
							key={`${ex.exerciseId}-${ei}`}
							style={styles.card}
							deleteLabel={tt('history.delete')}
							onDelete={() => {
								if (!session) return;
								setSession(removeLoggedExercise(session, ei));
							}}
						>
							<View style={styles.cardInner}>
								<Pressable
									style={styles.cardHead}
									accessibilityRole="button"
									accessibilityLabel={tt('exercise.openTechnique', {
										name: exerciseDisplayName(ex.exerciseId, locale)
									})}
									onPress={() => setTechniqueId(ex.exerciseId)}
								>
									<CatalogThumb imagePath={item?.image} size={48} whitePlate />
									<Text style={styles.cardTitle}>{exerciseDisplayName(ex.exerciseId, locale)}</Text>
								</Pressable>
								{editing
									? ex.sets.map((s, si) => (
											<View key={si} style={styles.editRow}>
												<TextInput
													style={styles.editInput}
													keyboardType="decimal-pad"
													value={s.weightKg != null ? String(s.weightKg) : ''}
													onChangeText={(v) => {
														const n = v.trim() === '' ? null : Number(v);
														setSession(
															updateLoggedSet(session, ei, si, {
																weightKg: n != null && Number.isFinite(n) ? n : null,
																completed: true
															})
														);
													}}
													placeholder={tt('common.kg')}
													placeholderTextColor={colors.muted}
												/>
												<TextInput
													style={styles.editInput}
													keyboardType="number-pad"
													value={s.reps != null ? String(s.reps) : ''}
													onChangeText={(v) => {
														const n = v.trim() === '' ? null : Number(v);
														setSession(
															updateLoggedSet(session, ei, si, {
																reps: n != null && Number.isFinite(n) ? n : null,
																completed: true
															})
														);
													}}
													placeholder={tt('common.reps')}
													placeholderTextColor={colors.muted}
												/>
												<Pressable
													style={styles.smallBtn}
													onPress={() =>
														setSession(
															removeLoggedSet(session, ei, si, { keepAtLeastOne: false })
														)
													}
												>
													<Text style={styles.removeText}>×</Text>
												</Pressable>
											</View>
										))
									: (
											<View style={styles.setGrid}>
												{done.map((s, si) => (
													<View key={si} style={styles.setCell}>
														<Text style={styles.setIndex}>{si + 1}</Text>
														<Text style={styles.setCellValue}>
															{s.weightKg != null ? `${s.weightKg}` : '-'}
															{' × '}
															{s.reps ?? '-'}
														</Text>
													</View>
												))}
											</View>
										)}
								{!editing && note ? <Text style={styles.note}>{note}</Text> : null}
								{editing ? (
									<>
										<PrimaryButton
											label={tt('history.addSet')}
											variant="ghost"
											onPress={() => setSession(addCompletedLoggedSet(session, ei))}
										/>
										<PrimaryButton
											label={tt('history.removeExercise')}
											variant="ghost"
											onPress={() => setSession(removeLoggedExercise(session, ei))}
										/>
									</>
								) : null}
							</View>
						</SwipeableRow>
					);
			})}
			{editing ? (
				<PrimaryButton label={tt('history.save')} onPress={() => void saveEdits()} />
			) : (
				<PrimaryButton label={tt('history.edit')} variant="ghost" onPress={() => setEditing(true)} />
			)}
			<PrimaryButton
				label={tt('history.toBuilder')}
				variant="ghost"
				onPress={() => void openAsPlan()}
			/>
			<PrimaryButton label={tt('history.delete')} variant="danger" onPress={confirmRemove} />
			<TechniqueSheet exerciseId={techniqueId} onClose={() => setTechniqueId(null)} />
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
	root: { padding: 16, gap: 10, backgroundColor: colors.bg },
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.bg,
		gap: 16,
		padding: 24
	},
	title: { color: colors.text, fontSize: 24, fontWeight: '800', fontFamily: fontFamily.extrabold },
	meta: { color: colors.muted, marginBottom: 8, fontFamily: fontFamily.regular },
		card: {
			backgroundColor: colors.panel,
			borderRadius: 14,
			borderWidth: 1,
			borderColor: colors.border
		},
		cardInner: {
			backgroundColor: colors.panel,
			padding: 14,
			gap: 6
		},
		cardHead: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.md,
			minHeight: touchMin
		},
		cardTitle: { color: colors.text, fontWeight: '700', marginBottom: 4, fontFamily: fontFamily.bold, flex: 1 },
	setLine: { color: colors.muted, fontVariant: ['tabular-nums'], fontFamily: fontFamily.regular },
	setGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: space.sm,
		marginTop: space.xs
	},
	setCell: {
		minWidth: '30%',
		flexGrow: 1,
		backgroundColor: colors.bg,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.border,
		paddingVertical: space.sm,
		paddingHorizontal: space.sm,
		gap: 2
	},
	setIndex: {
		color: colors.muted,
		fontSize: 11,
		fontWeight: '600',
		fontFamily: fontFamily.semibold
	},
	setCellValue: {
		color: colors.text,
		fontSize: 15,
		fontWeight: '700',
		fontVariant: ['tabular-nums'],
		fontFamily: fontFamily.bold
	},
	note: { color: colors.muted, fontSize: 13, marginTop: 4, fontFamily: fontFamily.regular },
	editRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
	editInput: {
		flex: 1,
		minHeight: touchMin,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.bg,
		color: colors.text,
		paddingHorizontal: 10,
		fontVariant: ['tabular-nums'],
		fontFamily: fontFamily.regular
	},
	smallBtn: {
		minWidth: touchMin,
		minHeight: touchMin,
		alignItems: 'center',
		justifyContent: 'center'
	},
	removeText: { color: colors.danger, fontSize: 24, fontFamily: fontFamily.regular },
	muted: { color: colors.muted, fontSize: 16, fontFamily: fontFamily.regular },
	undoBtn: {
		minHeight: touchMin,
		minWidth: touchMin,
		paddingHorizontal: 20,
		borderRadius: 14,
		backgroundColor: colors.accent,
		alignItems: 'center',
		justifyContent: 'center'
	},
	undoText: { color: colors.accentInk, fontWeight: '700', fontSize: 16, fontFamily: fontFamily.bold }
	});
}
