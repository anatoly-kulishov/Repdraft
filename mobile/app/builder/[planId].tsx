import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	Alert,
	FlatList,
	KeyboardAvoidingView,
	Platform,
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
	convertAltGroupToSuperset,
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
	updateExercise,
	updateGroupRest,
	updateGroupSets
} from '@repdraft/domain/workout';
import { exerciseMetaHint } from '@repdraft/domain/labels.ru';
import { shouldShowCoachmark } from '@repdraft/domain/onboarding';
import {
	POPULAR_EXERCISE_IDS,
	frequentExercises,
	type FrequentExercise
} from '@repdraft/domain/exerciseFrequency';
import type { ExerciseIndexItem, WorkoutPlan } from '@repdraft/domain/types';
import {
	exerciseDisplayName,
	filterExercises,
	getIndexItem,
	loadExerciseIndex,
	refreshCustomsCache,
	uniqueBodyParts
} from '../../src/catalog/loadIndex';
import { CatalogThumb } from '../../src/components/CatalogThumb';
import { BuilderPicker } from '../../src/builder/BuilderPicker';
import { Coachmark } from '../../src/components/Coachmark';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useBottomChromePad, useStackHeaderOffset } from '../../src/layout/safe';
import { routeParam } from '../../src/nav/params';
import { useLocale } from '../../src/state/locale';
import { loadOnboarding, dismissCoachmark } from '../../src/state/onboarding';
import { useAppColors } from '../../src/state/theme';
import { plansRepo } from '../../src/storage/plansRepo';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { deletePlanRemote, pushPlan } from '../../src/sync/cloudSync';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../../src/theme';

export default function BuilderScreen() {
	const { planId: planIdParam } = useLocalSearchParams<{ planId: string }>();
	const planId = routeParam(planIdParam);
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.md);
	const pickListPad = space.lg;
	const headerOffset = useStackHeaderOffset();
	const [plan, setPlan] = useState<WorkoutPlan | null>(null);
	const [bootError, setBootError] = useState(false);
	const [picking, setPicking] = useState(false);
	const [query, setQuery] = useState('');
	const [bodyPart, setBodyPart] = useState<string | 'all'>('all');
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const listPad = space.lg;
	const [catalogTick, setCatalogTick] = useState(0);
	const [flashId, setFlashId] = useState<string | null>(null);
	const [dirty, setDirty] = useState(false);
	const [showIntroCoachmark, setShowIntroCoachmark] = useState(false);
	const [showSupersetCoachmark, setShowSupersetCoachmark] = useState(false);
	const [frequent, setFrequent] = useState<FrequentExercise[]>([]);
	const [railNote, setRailNote] = useState<string | null>(null);
	const planRef = useRef<WorkoutPlan | null>(null);
	const railNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const catalog = useMemo(() => {
		void catalogTick;
		return loadExerciseIndex();
	}, [catalogTick]);
	const parts = useMemo(() => uniqueBodyParts(catalog), [catalog]);
	const pickList = useMemo(
		() => filterExercises(catalog, { query, bodyPart, locale }),
		[catalog, query, bodyPart, locale]
	);
	const inPlanIds = useMemo(
		() => new Set(plan?.exercises.map((e) => e.exerciseId) ?? []),
		[plan]
	);
	const frequentItems = useMemo(() => {
		const byId = new Map(catalog.map((item) => [item.id, item] as const));
		const ids = frequent.length
			? frequent.map((row) => row.exerciseId)
			: [...POPULAR_EXERCISE_IDS];
		return ids
			.map((id) => byId.get(id))
			.filter((item): item is NonNullable<typeof item> => Boolean(item));
	}, [catalog, frequent]);

	useEffect(() => {
		let alive = true;
		void sessionsRepo.list().then((list) => {
			if (alive) setFrequent(frequentExercises(list));
		});
		return () => {
			alive = false;
			if (railNoteTimer.current) clearTimeout(railNoteTimer.current);
		};
	}, []);

	useEffect(() => {
		planRef.current = plan;
	}, [plan]);

	const persist = useCallback(
		async (next: WorkoutPlan): Promise<boolean> => {
			const stamped: WorkoutPlan = {
				...next,
				updatedAt: new Date().toISOString(),
				name: clampPlanName(next.name)
			};
			setPlan(stamped);
			planRef.current = stamped;
			setDirty(true);
			try {
				await plansRepo.save(stamped);
				try {
					await pushPlan(stamped);
				} catch {
					/* offline */
				}
				return true;
			} catch {
				Alert.alert(tt('builder.saveFail'));
				return false;
			}
		},
		[tt]
	);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			setBootError(false);
			await refreshCustomsCache();
			if (!cancelled) setCatalogTick((n) => n + 1);

			if (!planId) {
				if (!cancelled) {
					setBootError(true);
					setPlan(null);
				}
				return;
			}

			try {
				let found = await plansRepo.get(planId);
				if (!found && (planId === 'new' || planId === 'draft')) {
					found = createEmptyDraft(tt('workouts.newName'));
					await plansRepo.save(found);
					if (!cancelled) router.replace(`/builder/${found.id}`);
					return;
				}
				if (!found) {
					if (!cancelled) {
						setBootError(true);
						setPlan(null);
					}
					return;
				}
				if (!cancelled) {
					setPlan(found);
					const ob = await loadOnboarding();
					setShowIntroCoachmark(shouldShowCoachmark(ob, 'builder.intro'));
					setShowSupersetCoachmark(shouldShowCoachmark(ob, 'builder.superset'));
				}
			} catch {
				if (!cancelled) {
					setBootError(true);
					setPlan(null);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [planId, router, tt]);

	function toggleSelect(exerciseId: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(exerciseId)) next.delete(exerciseId);
			else next.add(exerciseId);
			return next;
		});
	}

	async function addFromCatalog(item: ExerciseIndexItem) {
		const current = planRef.current;
		if (!current) return;
		if (inPlanIds.has(item.id)) {
			Alert.alert(tt('builder.alreadyInPlan'));
			return;
		}
		const { plan: next, added } = addExercise(current, item.id, {
			name: item.name,
			equipment: item.equipment
		});
		if (!added) {
			Alert.alert(tt('builder.alreadyInPlan'));
			return;
		}
		const ok = await persist(next);
		if (ok) {
			setFlashId(item.id);
			setTimeout(() => setFlashId(null), 900);
			setRailNote(tt('exercise.added'));
			if (railNoteTimer.current) clearTimeout(railNoteTimer.current);
			railNoteTimer.current = setTimeout(() => setRailNote(null), 1600);
		}
	}

	function offerMore() {
		if (!plan) return;
		Alert.alert(tt('builder.more'), undefined, [
			{ text: tt('common.cancel'), style: 'cancel' },
			{
				text: tt('ai.open'),
				onPress: () => router.push('/ai')
			},
			{
				text: tt('builder.duplicate'),
				onPress: () => {
					void (async () => {
						try {
							const copy = duplicatePlan(plan);
							await plansRepo.save(copy);
							try {
								await pushPlan(copy);
							} catch {
								/* offline */
							}
							router.replace(`/builder/${copy.id}`);
						} catch {
							Alert.alert(tt('builder.saveFail'));
						}
					})();
				}
			},
			{
				text: tt('builder.delete'),
				style: 'destructive',
				onPress: () => {
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
			}
		]);
	}

	async function commitSave() {
		const current = planRef.current;
		if (!current) return;
		if (current.exercises.length === 0) {
			Alert.alert(tt('builder.saveNeedExercises'));
			return;
		}
		const ok = await persist(current);
		if (ok) {
			setDirty(false);
			router.replace(`/plan/${current.id}`);
		}
	}

	if (bootError) {
		return (
			<View style={styles.center}>
				<Text style={styles.muted}>{tt('builder.loadFail')}</Text>
				<PrimaryButton label={tt('workouts.create')} onPress={() => {
					void (async () => {
						try {
							const created = createEmptyDraft(tt('workouts.newName'));
							await plansRepo.save(created);
							router.replace(`/builder/${created.id}`);
						} catch {
							Alert.alert(tt('builder.saveFail'));
						}
					})();
				}} />
				<PrimaryButton label={tt('summary.back')} variant="ghost" onPress={() => router.replace('/')} />
			</View>
		);
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
			<BuilderPicker
				query={query}
				onQueryChange={setQuery}
				bodyPart={bodyPart}
				onBodyPartChange={setBodyPart}
				parts={parts}
				pickList={pickList}
				frequentItems={frequentItems}
				frequentCount={frequent.length}
				inPlanIds={inPlanIds}
				flashId={flashId}
				railNote={railNote}
				planExerciseCount={plan.exercises.length}
				headerOffset={headerOffset}
				bottomPad={bottomPad}
				onAdd={(item) => void addFromCatalog(item)}
				onDone={() => {
					setPicking(false);
					setQuery('');
					setBodyPart('all');
				}}
			/>
		);
	}

	const selectedIds = [...selected];

	return (
		<KeyboardAvoidingView
			style={styles.root}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			keyboardVerticalOffset={88}
		>
			{showIntroCoachmark ? (
				<Coachmark
					message={tt('onboarding.coachBuilderIntro')}
					onDismiss={() => {
						setShowIntroCoachmark(false);
						void dismissCoachmark('builder.intro');
					}}
				/>
			) : null}
			{showSupersetCoachmark ? (
				<Coachmark
					message={tt('onboarding.coachBuilderSuperset')}
					onDismiss={() => {
						setShowSupersetCoachmark(false);
						void dismissCoachmark('builder.superset');
					}}
				/>
			) : null}
			<Text style={styles.label}>{tt('builder.name')}</Text>
			<TextInput
				style={styles.input}
				value={plan.name}
				onChangeText={(name) => {
					const next = { ...plan, name };
					setPlan(next);
					planRef.current = next;
				}}
				onEndEditing={() => {
					const current = planRef.current;
					if (current) void persist(current);
				}}
				placeholderTextColor={colors.muted}
			/>
			{selectedIds.length >= 2 ? (
				<View style={styles.groupBar}>
					<Text style={styles.muted}>{tt('builder.selected', { n: selectedIds.length })}</Text>
					<View style={styles.groupActions}>
						<View style={styles.flex}>
							<PrimaryButton
								label={tt('builder.superset')}
								compact
								onPress={() => {
									void persist(formSuperset(plan, selectedIds)).then(() => setSelected(new Set()));
								}}
							/>
						</View>
						<View style={styles.flex}>
							<PrimaryButton
								label={tt('builder.or', { n: selectedIds.length })}
								variant="ghost"
								compact
								onPress={() => {
									void persist(formOrGroup(plan, selectedIds)).then(() => setSelected(new Set()));
								}}
							/>
						</View>
					</View>
				</View>
			) : null}
			<FlatList
				style={styles.flex}
				data={plan.exercises}
				keyExtractor={(item, i) => `${item.exerciseId}-${i}`}
				contentContainerStyle={[
					styles.list,
					plan.exercises.length > 0 && styles.listPanel,
					{ paddingBottom: listPad }
				]}
				ListEmptyComponent={
					<View style={styles.emptyWrap}>
						<View style={styles.emptyIcon}>
							<Plus size={28} color={colors.accent} strokeWidth={2.5} />
						</View>
						<Text style={styles.emptyTitle}>{tt('builder.emptyTitle')}</Text>
						<Text style={styles.empty}>{tt('builder.emptyDesc')}</Text>
						<PrimaryButton
							label={tt('builder.addExerciseShort')}
							onPress={() => setPicking(true)}
						/>
						<Pressable
							accessibilityRole="button"
							style={styles.aiOutline}
							onPress={() => router.push('/ai')}
						>
							<Sparkles size={18} color={colors.accentText} strokeWidth={2.25} />
							<Text style={styles.aiOutlineText}>{tt('builder.createWithAi')}</Text>
						</Pressable>
					</View>
				}
				keyboardShouldPersistTaps="handled"
				renderItem={({ item, index }) => {
					const meta = getIndexItem(item.exerciseId);
					const gRole = groupMemberRole(plan.exercises, index);
					const aRole = altGroupMemberRole(plan.exercises, index);
					const badge =
						gRole !== 'solo'
							? tt('preview.superset')
							: aRole !== 'solo'
								? tt('builder.orBadge')
								: null;
					const on = selected.has(item.exerciseId);
					const groupLead = Boolean(
						(item.groupId && gRole === 'first') || (item.altGroupId && aRole === 'first')
					);
					const metaHint = meta ? exerciseMetaHint(meta, locale) : '';
					return (
						<View
							style={[
								styles.card,
								on && styles.cardOn,
								index === plan.exercises.length - 1 && styles.cardLast
							]}
						>
							<View style={styles.cardHead}>
								<Pressable
									accessibilityRole="checkbox"
									accessibilityState={{ checked: on }}
									style={[styles.check, on && styles.checkOn]}
									hitSlop={12}
									onPress={() => toggleSelect(item.exerciseId)}
								>
									<Text style={[styles.checkText, on && styles.checkTextOn]}>
										{on ? '✓' : ''}
									</Text>
								</Pressable>
								<View style={styles.moveCol}>
									<Pressable
										accessibilityRole="button"
										style={styles.moveBtn}
										disabled={index === 0}
										onPress={() => void persist(moveByArrow(plan, index, -1))}
									>
										<Text style={[styles.moveText, index === 0 && styles.moveDisabled]}>↑</Text>
									</Pressable>
									<Pressable
										accessibilityRole="button"
										style={styles.moveBtn}
										disabled={index >= plan.exercises.length - 1}
										onPress={() => void persist(moveByArrow(plan, index, 1))}
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
								<CatalogThumb imagePath={meta?.image} size={48} whitePlate rounded={radius.md} />
								<View style={styles.flex}>
									{badge ? <Text style={styles.badge}>{badge}</Text> : null}
									<Text style={styles.rowTitle}>
										{exerciseDisplayName(item.exerciseId, locale)}
									</Text>
									<Text style={styles.meta}>
										{formatExercisePrescription(item)}
										{metaHint ? ` · ${metaHint}` : meta?.equipment ? ` · ${meta.equipment}` : ''}
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
										void persist(removeExercise(plan, item.exerciseId));
									}}
								>
									<Text style={styles.removeText}>×</Text>
								</Pressable>
							</View>
							{groupLead ? (
								<View style={styles.groupLeadActions}>
									<PrimaryButton
										label={tt('builder.dissolve')}
										variant="ghost"
										compact
										onPress={() => {
											if (item.groupId) void persist(dissolveSuperset(plan, item.groupId));
											else if (item.altGroupId) void persist(dissolveOrGroup(plan, item.altGroupId));
										}}
									/>
									{item.altGroupId && aRole === 'first' ? (
										<PrimaryButton
											label={tt('builder.toSuperset')}
											variant="ghost"
											compact
											onPress={() =>
												void persist(convertAltGroupToSuperset(plan, item.altGroupId!))
											}
										/>
									) : null}
								</View>
							) : null}
							<View style={styles.fields}>
								<Stepper
									styles={styles}
									label={tt('builder.sets')}
									value={item.sets}
									onDec={() => {
										if (item.groupId && gRole !== 'solo') {
											void persist(updateGroupSets(plan, item.groupId, item.sets - 1));
										} else {
											void persist(
												updateExercise(plan, item.exerciseId, { sets: item.sets - 1 })
											);
										}
									}}
									onInc={() => {
										if (item.groupId && gRole !== 'solo') {
											void persist(updateGroupSets(plan, item.groupId, item.sets + 1));
										} else {
											void persist(
												updateExercise(plan, item.exerciseId, { sets: item.sets + 1 })
											);
										}
									}}
								/>
								<Text style={styles.times}>×</Text>
								<Stepper
									styles={styles}
									label={tt('common.reps')}
									value={item.reps}
									onDec={() =>
										void persist(
											updateExercise(plan, item.exerciseId, { reps: item.reps - 1 })
										)
									}
									onInc={() =>
										void persist(
											updateExercise(plan, item.exerciseId, { reps: item.reps + 1 })
										)
									}
								/>
								<Stepper
									styles={styles}
									label={tt('builder.rest')}
									value={item.restSec}
									onDec={() => {
										if (item.groupId && gRole !== 'solo') {
											void persist(updateGroupRest(plan, item.groupId, item.restSec - 15));
										} else {
											void persist(
												updateExercise(plan, item.exerciseId, {
													restSec: item.restSec - 15
												})
											);
										}
									}}
									onInc={() => {
										if (item.groupId && gRole !== 'solo') {
											void persist(updateGroupRest(plan, item.groupId, item.restSec + 15));
										} else {
											void persist(
												updateExercise(plan, item.exerciseId, {
													restSec: item.restSec + 15
												})
											);
										}
									}}
								/>
							</View>
							<PrimaryButton
								label={hasLadderScheme(item) ? tt('builder.ladderOff') : tt('builder.ladder')}
								variant="ghost"
								compact
								onPress={() => {
									if (hasLadderScheme(item)) {
										void persist(
											updateExercise(plan, item.exerciseId, {
												repsScheme: undefined
											})
										);
									} else {
										const scheme = buildLadderScheme(item.reps, Math.max(1, item.reps - 4));
										void persist(updateExercise(plan, item.exerciseId, { repsScheme: scheme }));
									}
								}}
							/>
						</View>
					);
				}}
			/>
			<Stack.Screen
				options={{
					headerRight: () => (
						<Pressable accessibilityRole="button" hitSlop={8} onPress={offerMore}>
							<Text style={styles.headerMore}>{tt('builder.more')}</Text>
						</Pressable>
					)
				}}
			/>
			<View style={[styles.sticky, { paddingBottom: bottomPad }]}>
				<View style={styles.stickyRow}>
					<View style={styles.flex}>
						<PrimaryButton
							label={`+ ${tt('builder.addExerciseShort')}`}
							variant="secondary"
							onPress={() => setPicking(true)}
						/>
					</View>
					<View style={[styles.flex, !dirty && styles.saveDim]}>
						<PrimaryButton
							label={tt('builder.save')}
							onPress={() => void commitSave()}
							disabled={!dirty && plan.exercises.length === 0}
						/>
					</View>
				</View>
			</View>
		</KeyboardAvoidingView>
	);
}

type BuilderStyles = ReturnType<typeof makeStyles>;

function Stepper({
	styles,
	label,
	value,
	onDec,
	onInc
}: {
	styles: BuilderStyles;
	label: string;
	value: number;
	onDec: () => void;
	onInc: () => void;
}) {
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel} numberOfLines={1}>
				{label}
			</Text>
			<View style={styles.fieldRow}>
				<Pressable accessibilityRole="button" hitSlop={8} style={styles.stepBtn} onPress={onDec}>
					<Text style={styles.stepBtnText}>-</Text>
				</Pressable>
				<Text style={styles.stepValue}>{value}</Text>
				<Pressable accessibilityRole="button" hitSlop={8} style={styles.stepBtn} onPress={onInc}>
					<Text style={styles.stepBtnText}>+</Text>
				</Pressable>
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
	root: { flex: 1, padding: space.lg, gap: space.sm, backgroundColor: colors.bg },
	flex: { flex: 1 },
	center: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.bg,
		padding: space.lg,
		gap: space.md
	},
	label: { color: colors.muted, fontWeight: '700', fontSize: 12, letterSpacing: 0.4, fontFamily: fontFamily.bold },
	input: {
		minHeight: touchMin,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel,
		color: colors.text,
		paddingHorizontal: space.md,
		fontSize: 17,
		fontWeight: '700',
		fontFamily: fontFamily.bold
	},
	empty: { color: colors.muted, textAlign: 'center', lineHeight: 22, fontFamily: fontFamily.regular },
	aiOutline: {
		minHeight: touchMin,
		minWidth: touchMin,
		alignSelf: 'stretch',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: space.sm,
		borderRadius: radius.xl,
		borderWidth: 1,
		borderColor: colors.accent,
		paddingHorizontal: space.lg
	},
	aiOutlineText: {
		color: colors.accentText,
		fontSize: 16,
		fontWeight: '600',
		fontFamily: fontFamily.semibold
	},
	checkTextOn: { color: colors.accentText },
	moveCol: { gap: 2 },
	moveBtn: {
		minWidth: touchMin,
		minHeight: touchMin,
		alignItems: 'center',
		justifyContent: 'center'
	},
	moveText: { color: colors.text, fontSize: 18, fontWeight: '700', fontFamily: fontFamily.bold },
	moveDisabled: { color: colors.muted, opacity: 0.35 },
	badge: { color: colors.accent, fontSize: 11, fontWeight: '800', marginBottom: 2, fontFamily: fontFamily.extrabold },
	rowTitle: { color: colors.text, fontWeight: '700', fontSize: 16, fontFamily: fontFamily.bold },
	meta: { color: colors.muted, marginTop: 2, fontSize: 13, fontFamily: fontFamily.regular },
	muted: { color: colors.muted, textAlign: 'center', fontFamily: fontFamily.regular },
	remove: { minWidth: touchMin, minHeight: touchMin, alignItems: 'center', justifyContent: 'center' },
	removeText: { color: colors.danger, fontSize: 28, fontWeight: '300', fontFamily: fontFamily.regular },
	fields: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
	times: {
		color: colors.muted,
		fontSize: 16,
		fontWeight: '700',
		marginBottom: 8,
		fontFamily: fontFamily.bold
	},
	field: { flex: 1, minWidth: 0, gap: 4 },
	fieldLabel: {
		color: colors.muted,
		fontSize: 11,
		fontWeight: '600',
		fontFamily: fontFamily.semibold
	},
	fieldRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		minHeight: touchMin,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.bg,
		paddingHorizontal: space.xs
	},
	stepBtn: {
		minWidth: touchMin,
		minHeight: touchMin,
		alignItems: 'center',
		justifyContent: 'center'
	},
	stepBtnText: { color: colors.muted, fontSize: 16, fontWeight: '700', fontFamily: fontFamily.bold },
	stepValue: {
		minWidth: 22,
		textAlign: 'center',
		color: colors.text,
		fontWeight: '800',
		fontVariant: ['tabular-nums'],
		fontFamily: fontFamily.extrabold
	},
	groupBar: { gap: space.sm },
	groupActions: { flexDirection: 'row', gap: space.sm },
	groupLeadActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
	sticky: {
		gap: space.sm,
		paddingTop: space.sm,
		borderTopWidth: 1,
		borderTopColor: colors.border,
		backgroundColor: colors.bg
	},
	stickyRow: { flexDirection: 'row', gap: space.sm },
	headerMore: {
		color: colors.text,
		fontSize: 17,
		fontWeight: '600',
		fontFamily: fontFamily.semibold,
		paddingHorizontal: 4
	},
	card: {
		backgroundColor: colors.panel,
		borderRadius: 0,
		borderWidth: 0,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
		padding: space.lg,
		gap: space.sm
	},
	cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
	cardLast: { borderBottomWidth: 0 },
	cardOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
	check: {
		width: 24,
		height: 24,
		borderRadius: 7,
		borderWidth: 2,
		borderColor: colors.border,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.bg
	},
	checkOn: { borderColor: colors.accent, backgroundColor: colors.accent },
	checkText: {
		color: colors.accent,
		fontWeight: '800',
		fontSize: 14,
		lineHeight: 16,
		fontFamily: fontFamily.extrabold
	},
	emptyIcon: {
		width: 72,
		height: 72,
		borderRadius: radius.pill,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.accentDim,
		borderWidth: 1,
		borderColor: colors.accent
	},
	emptyTitle: {
		color: colors.text,
		fontSize: 20,
		fontWeight: '800',
		textAlign: 'center',
		fontFamily: fontFamily.extrabold
	},
	emptyWrap: {
		alignItems: 'center',
		gap: space.md,
		marginTop: 48,
		paddingHorizontal: space.sm,
		paddingVertical: space.xl
	},
	list: { gap: 0, paddingBottom: space.sm, flexGrow: 1 },
	listPanel: {
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		overflow: 'hidden',
		backgroundColor: colors.panel
	},
	saveDim: { opacity: 0.55 },
	});
}
