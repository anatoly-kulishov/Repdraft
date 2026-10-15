import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
	Alert,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import { clampPlanName } from '@repdraft/domain/inputLimits';
import {
	addExercise,
	altGroupMemberRole,
	buildLadderScheme,
	createEmptyDraft,
	dissolveOrGroup,
	dissolveSuperset,
	duplicatePlan,
	formOrGroup,
	formSuperset,
	formatExercisePrescription,
	groupMemberRole,
	hasLadderScheme,
	moveByArrow,
	removeExercise,
	updateExercise
} from '@repdraft/domain/workout';
import type { WorkoutPlan } from '@repdraft/domain/types';
import {
	exerciseDisplayName,
	filterExercises,
	getIndexItem,
	loadExerciseIndex,
	refreshCustomsCache
} from '../../src/catalog/loadIndex';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useLocale } from '../../src/state/locale';
import { plansRepo } from '../../src/storage/plansRepo';
import { deletePlanRemote, pushPlan } from '../../src/sync/cloudSync';
import { colors, touchMin } from '../../src/theme';

function Stepper({
	label,
	value,
	onDec,
	onInc
}: {
	label: string;
	value: number;
	onDec: () => void;
	onInc: () => void;
}) {
	return (
		<View style={styles.stepper}>
			<Text style={styles.stepLabel}>{label}</Text>
			<View style={styles.stepRow}>
				<Pressable accessibilityRole="button" style={styles.stepBtn} onPress={onDec}>
					<Text style={styles.stepBtnText}>-</Text>
				</Pressable>
				<Text style={styles.stepValue}>{value}</Text>
				<Pressable accessibilityRole="button" style={styles.stepBtn} onPress={onInc}>
					<Text style={styles.stepBtnText}>+</Text>
				</Pressable>
			</View>
		</View>
	);
}

export default function BuilderScreen() {
	const { planId } = useLocalSearchParams<{ planId: string }>();
	const router = useRouter();
	const { locale, tt } = useLocale();
	const [plan, setPlan] = useState<WorkoutPlan | null>(null);
	const [picking, setPicking] = useState(false);
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [catalogTick, setCatalogTick] = useState(0);
	const catalog = useMemo(() => {
		void catalogTick;
		return loadExerciseIndex();
	}, [catalogTick]);
	const pickList = useMemo(
		() => filterExercises(catalog, { query, bodyPart: 'all', locale }).slice(0, 80),
		[catalog, query, locale]
	);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			await refreshCustomsCache();
			if (!cancelled) setCatalogTick((n) => n + 1);
			if (!planId) return;
			let found = await plansRepo.get(planId);
			if (!found && planId === 'new') {
				found = createEmptyDraft(tt('workouts.newName'));
				await plansRepo.save(found);
				if (!cancelled) router.replace(`/builder/${found.id}`);
				return;
			}
			if (!cancelled) setPlan(found);
		})();
		return () => {
			cancelled = true;
		};
	}, [planId, router]);

	async function save(next: WorkoutPlan) {
		const stamped = {
			...next,
			updatedAt: new Date().toISOString(),
			name: clampPlanName(next.name)
		};
		setPlan(stamped);
		await plansRepo.save(stamped);
		try {
			await pushPlan(stamped);
		} catch {
			/* offline */
		}
	}

	function toggleSelect(exerciseId: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(exerciseId)) next.delete(exerciseId);
			else next.add(exerciseId);
			return next;
		});
	}

	async function removePlan() {
		if (!plan) return;
		Alert.alert(tt('builder.delete'), plan.name, [
			{ text: tt('common.cancel'), style: 'cancel' },
			{
				text: tt('builder.delete'),
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await plansRepo.remove(plan.id);
						try {
							await deletePlanRemote(plan.id);
						} catch {
							/* offline */
						}
						router.replace('/');
					})();
				}
			}
		]);
	}

	if (!plan) {
		return (
			<View style={styles.center}>
				<Text style={styles.muted}>…</Text>
			</View>
		);
	}

	if (picking) {
		return (
			<View style={styles.root}>
				<TextInput
					style={styles.input}
					value={query}
					onChangeText={setQuery}
					placeholder={tt('exercises.search')}
					placeholderTextColor={colors.muted}
				/>
				<FlatList
					data={pickList}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => (
						<Pressable
							style={styles.row}
							onPress={() => {
								void save(
									addExercise(plan, item.id, {
										name: item.name,
										equipment: item.equipment
									}).plan
								).then(() => setPicking(false));
							}}
						>
							<Text style={styles.rowTitle}>{exerciseDisplayName(item.id, locale)}</Text>
						</Pressable>
					)}
				/>
				<PrimaryButton label={tt('common.cancel')} variant="ghost" onPress={() => setPicking(false)} />
			</View>
		);
	}

	const selectedIds = [...selected];

	return (
		<View style={styles.root}>
			<Text style={styles.label}>{tt('builder.name')}</Text>
			<TextInput
				style={styles.input}
				value={plan.name}
				onChangeText={(name) => setPlan({ ...plan, name })}
				onEndEditing={() => void save(plan)}
				placeholderTextColor={colors.muted}
			/>
			{selectedIds.length >= 2 ? (
				<View style={styles.groupBar}>
					<Text style={styles.muted}>{tt('builder.selected', { n: selectedIds.length })}</Text>
					<View style={styles.groupActions}>
						<PrimaryButton
							label={tt('builder.superset')}
							onPress={() => {
								void save(formSuperset(plan, selectedIds)).then(() => setSelected(new Set()));
							}}
						/>
						<PrimaryButton
							label={tt('builder.orGroup')}
							variant="ghost"
							onPress={() => {
								void save(formOrGroup(plan, selectedIds)).then(() => setSelected(new Set()));
							}}
						/>
					</View>
				</View>
			) : null}
			{plan.exercises.length === 0 ? (
				<Text style={styles.muted}>{tt('builder.empty')}</Text>
			) : (
				<FlatList
					data={plan.exercises}
					keyExtractor={(item, i) => `${item.exerciseId}-${i}`}
					contentContainerStyle={{ gap: 10 }}
					renderItem={({ item, index }) => {
						const meta = getIndexItem(item.exerciseId);
						const gRole = groupMemberRole(plan.exercises, index);
						const aRole = altGroupMemberRole(plan.exercises, index);
						const badge =
							gRole !== 'solo'
								? tt('preview.superset')
								: aRole !== 'solo'
									? tt('preview.or')
									: null;
						const on = selected.has(item.exerciseId);
						return (
							<View style={[styles.card, on && styles.cardOn]}>
								<View style={styles.cardHead}>
									<Pressable
										accessibilityRole="checkbox"
										accessibilityState={{ checked: on }}
										style={styles.check}
										onPress={() => toggleSelect(item.exerciseId)}
									>
										<Text style={styles.checkText}>{on ? '✓' : ''}</Text>
									</Pressable>
									<View style={styles.moveCol}>
										<Pressable
											accessibilityRole="button"
											style={styles.moveBtn}
											disabled={index === 0}
											onPress={() => void save(moveByArrow(plan, index, -1))}
										>
											<Text style={[styles.moveText, index === 0 && styles.moveDisabled]}>↑</Text>
										</Pressable>
										<Pressable
											accessibilityRole="button"
											style={styles.moveBtn}
											disabled={index >= plan.exercises.length - 1}
											onPress={() => void save(moveByArrow(plan, index, 1))}
										>
											<Text
												style={[
													styles.moveText,
													index >= plan.exercises.length - 1 && styles.moveDisabled
												]}
											>
												↓
											</Text>
										</Pressable>
									</View>
									<View style={{ flex: 1 }}>
										{badge ? <Text style={styles.badge}>{badge}</Text> : null}
										<Text style={styles.rowTitle}>
											{exerciseDisplayName(item.exerciseId, locale)}
										</Text>
										<Text style={styles.meta}>
											{formatExercisePrescription(item)}
											{meta ? ` · ${meta.equipment}` : ''}
										</Text>
									</View>
									<Pressable
										accessibilityRole="button"
										style={styles.remove}
										onPress={() => {
											setSelected((s) => {
												const n = new Set(s);
												n.delete(item.exerciseId);
												return n;
											});
											void save(removeExercise(plan, item.exerciseId));
										}}
									>
										<Text style={styles.removeText}>×</Text>
									</Pressable>
								</View>
								{(item.groupId && gRole === 'first') || (item.altGroupId && aRole === 'first') ? (
									<PrimaryButton
										label={tt('builder.dissolve')}
										variant="ghost"
										onPress={() => {
											if (item.groupId) void save(dissolveSuperset(plan, item.groupId));
											else if (item.altGroupId) void save(dissolveOrGroup(plan, item.altGroupId));
										}}
									/>
								) : null}
								<View style={styles.steppers}>
									<Stepper
										label={tt('builder.sets')}
										value={item.sets}
										onDec={() =>
											void save(updateExercise(plan, item.exerciseId, { sets: item.sets - 1 }))
										}
										onInc={() =>
											void save(updateExercise(plan, item.exerciseId, { sets: item.sets + 1 }))
										}
									/>
									<Stepper
										label={tt('common.reps')}
										value={item.reps}
										onDec={() =>
											void save(updateExercise(plan, item.exerciseId, { reps: item.reps - 1 }))
										}
										onInc={() =>
											void save(updateExercise(plan, item.exerciseId, { reps: item.reps + 1 }))
										}
									/>
									<Stepper
										label={tt('builder.rest')}
										value={item.restSec}
										onDec={() =>
											void save(
												updateExercise(plan, item.exerciseId, { restSec: item.restSec - 15 })
											)
										}
										onInc={() =>
											void save(
												updateExercise(plan, item.exerciseId, { restSec: item.restSec + 15 })
											)
										}
									/>
								</View>
								<PrimaryButton
									label={hasLadderScheme(item) ? tt('builder.ladderOff') : tt('builder.ladder')}
									variant="ghost"
									onPress={() => {
										if (hasLadderScheme(item)) {
											void save(
												updateExercise(plan, item.exerciseId, {
													repsScheme: undefined
												})
											);
										} else {
											const scheme = buildLadderScheme(item.reps, Math.max(1, item.reps - 4));
											void save(
												updateExercise(plan, item.exerciseId, { repsScheme: scheme })
											);
										}
									}}
								/>
							</View>
						);
					}}
				/>
			)}
			<PrimaryButton label={tt('builder.add')} onPress={() => setPicking(true)} />
			<PrimaryButton
				label={tt('builder.duplicate')}
				variant="ghost"
				onPress={() => {
					void (async () => {
						const copy = duplicatePlan(plan);
						await plansRepo.save(copy);
						try {
							await pushPlan(copy);
						} catch {
							/* offline */
						}
						router.replace(`/builder/${copy.id}`);
					})();
				}}
			/>
			<PrimaryButton
				label={tt('builder.save')}
				variant="ghost"
				onPress={() => void save(plan).then(() => router.replace(`/plan/${plan.id}`))}
			/>
			<PrimaryButton label={tt('builder.delete')} variant="danger" onPress={() => void removePlan()} />
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 16, gap: 10, backgroundColor: colors.bg },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
	label: { color: colors.muted, fontWeight: '600' },
	input: {
		minHeight: touchMin,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel,
		color: colors.text,
		paddingHorizontal: 14,
		fontSize: 16
	},
	row: {
		minHeight: touchMin,
		backgroundColor: colors.panel,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 14
	},
	card: {
		backgroundColor: colors.panel,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 12,
		gap: 10
	},
	cardOn: { borderColor: colors.accent },
	cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	check: {
		minWidth: touchMin,
		minHeight: touchMin,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: colors.border,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.bg
	},
	checkText: { color: colors.accent, fontWeight: '800', fontSize: 18 },
	moveCol: { gap: 2 },
	moveBtn: {
		minWidth: touchMin,
		minHeight: touchMin,
		alignItems: 'center',
		justifyContent: 'center'
	},
	moveText: { color: colors.text, fontSize: 18, fontWeight: '700' },
	moveDisabled: { color: colors.muted, opacity: 0.35 },
	badge: { color: colors.accent, fontSize: 11, fontWeight: '800', marginBottom: 2 },
	rowTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
	meta: { color: colors.muted, marginTop: 4, fontSize: 13 },
	muted: { color: colors.muted },
	remove: { minWidth: touchMin, minHeight: touchMin, alignItems: 'center', justifyContent: 'center' },
	removeText: { color: colors.danger, fontSize: 28, fontWeight: '300' },
	steppers: { flexDirection: 'row', gap: 8 },
	stepper: { flex: 1, gap: 4 },
	stepLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
	stepRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
	stepBtn: {
		minWidth: touchMin,
		minHeight: touchMin,
		borderRadius: 10,
		backgroundColor: colors.bg,
		borderWidth: 1,
		borderColor: colors.border,
		alignItems: 'center',
		justifyContent: 'center'
	},
	stepBtnText: { color: colors.text, fontSize: 20, fontWeight: '700' },
	stepValue: {
		flex: 1,
		textAlign: 'center',
		color: colors.text,
		fontWeight: '800',
		fontVariant: ['tabular-nums']
	},
	groupBar: { gap: 8 },
	groupActions: { flexDirection: 'row', gap: 8 }
});
