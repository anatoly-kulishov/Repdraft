import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { labelBodyPart } from '@repdraft/domain/labels.ru';
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
import { Coachmark } from '../../src/components/Coachmark';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useBottomChromePad, useStackHeaderOffset } from '../../src/layout/safe';
import { routeParam } from '../../src/nav/params';
import { useLocale } from '../../src/state/locale';
import { loadOnboarding, dismissCoachmark } from '../../src/state/onboarding';
import { useAppColors } from '../../src/state/theme';
import { plansRepo } from '../../src/storage/plansRepo';
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
	const [showIntroCoachmark, setShowIntroCoachmark] = useState(false);
	const [showSupersetCoachmark, setShowSupersetCoachmark] = useState(false);
	const planRef = useRef<WorkoutPlan | null>(null);

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
		if (ok) router.replace(`/plan/${current.id}`);
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
			<KeyboardAvoidingView
				style={styles.root}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				keyboardVerticalOffset={Platform.OS === 'ios' ? headerOffset : 0}
			>
				<TextInput
					style={styles.input}
					value={query}
					onChangeText={setQuery}
					placeholder={tt('exercises.search')}
					placeholderTextColor={colors.muted}
					autoFocus
				/>
				<Text style={styles.pickHint}>{tt('builder.pickHint')}</Text>
				<FlatList
					horizontal
					style={styles.chipStrip}
					data={['all', ...parts] as const}
					keyExtractor={(p) => p}
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.chips}
					renderItem={({ item: part }) => {
						const on = bodyPart === part;
						const label =
							part === 'all' ? tt('exercises.all') : labelBodyPart(part, locale);
						return (
							<Pressable
								style={[styles.chip, on && styles.chipOn]}
								onPress={() => setBodyPart(part)}
							>
								<Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
									{label}
								</Text>
							</Pressable>
						);
					}}
				/>
				<FlatList
					style={styles.flex}
					data={pickList}
					keyExtractor={(item) => item.id}
					keyboardShouldPersistTaps="handled"
					initialNumToRender={24}
					windowSize={8}
					contentContainerStyle={{ paddingBottom: pickListPad, gap: space.sm }}
					ListEmptyComponent={<Text style={styles.emptyPick}>{tt('builder.noMatches')}</Text>}
					renderItem={({ item }) => {
						const inPlan = inPlanIds.has(item.id);
						const flashed = flashId === item.id;
						return (
							<Pressable
								style={[
									styles.pickRow,
									inPlan && styles.pickRowIn,
									flashed && styles.pickRowFlash
								]}
								onPress={() => void addFromCatalog(item)}
							>
								<CatalogThumb imagePath={item.image} size={48} />
								<View style={styles.flex}>
									<Text style={styles.rowTitle} numberOfLines={2}>
										{exerciseDisplayName(item.id, locale)}
									</Text>
									<Text style={styles.meta} numberOfLines={1}>
										{item.body_part}
										{item.equipment ? ` · ${item.equipment}` : ''}
									</Text>
								</View>
								<Text style={[styles.pickMark, inPlan && styles.pickMarkOn]}>
									{inPlan ? '✓' : '+'}
								</Text>
							</Pressable>
						);
					}}
				/>
				<View style={[styles.sticky, { paddingBottom: bottomPad }]}>
					<PrimaryButton
						label={`${tt('builder.done')} (${plan.exercises.length})`}
						onPress={() => {
							setPicking(false);
							setQuery('');
							setBodyPart('all');
						}}
					/>
				</View>
			</KeyboardAvoidingView>
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
						<Text style={styles.empty}>{tt('builder.empty')}</Text>
						<PrimaryButton
							label={tt('builder.createWithAi')}
							variant="secondary"
							onPress={() => router.push('/ai')}
						/>
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
								<CatalogThumb imagePath={meta?.image} size={48} />
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
							label={tt('builder.addExerciseShort')}
							variant="secondary"
							onPress={() => setPicking(true)}
						/>
					</View>
					<View style={styles.flex}>
						<PrimaryButton label={tt('builder.save')} onPress={() => void commitSave()} />
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
	pickHint: { color: colors.muted, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
	chipStrip: { flexGrow: 0, flexShrink: 0, height: touchMin },
	chips: { gap: space.sm, alignItems: 'center', paddingVertical: 0 },
	chip: {
		height: touchMin,
		paddingHorizontal: space.md,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: space.sm
	},
	chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
	chipText: { color: colors.muted, fontWeight: '700', fontSize: 13, fontFamily: fontFamily.bold },
	chipTextOn: { color: colors.accentText, fontFamily: fontFamily.bold },
	list: { gap: 0, paddingBottom: space.sm, flexGrow: 1 },
	listPanel: {
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		overflow: 'hidden',
		backgroundColor: colors.panel
	},
	emptyWrap: { alignItems: 'stretch', gap: space.md, marginTop: 48, paddingHorizontal: space.sm },
	empty: { color: colors.muted, textAlign: 'center', lineHeight: 22, fontFamily: fontFamily.regular },
	emptyPick: { color: colors.muted, textAlign: 'center', marginTop: 32, fontFamily: fontFamily.regular },
	pickRow: {
		minHeight: touchMin + 8,
		backgroundColor: colors.panel,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		paddingHorizontal: space.md,
		paddingVertical: space.sm,
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
		marginBottom: space.sm
	},
	pickRowIn: { opacity: 0.55 },
	pickRowFlash: { borderColor: colors.accent, backgroundColor: colors.accentDim },
	pickMark: {
		minWidth: touchMin,
		minHeight: touchMin,
		textAlign: 'center',
		textAlignVertical: 'center',
		color: colors.accent,
		fontSize: 22,
		fontWeight: '800',
		paddingTop: 10,
		fontFamily: fontFamily.extrabold
	},
	pickMarkOn: { color: colors.muted },
	card: {
		backgroundColor: colors.panel,
		borderRadius: 0,
		borderWidth: 0,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
		padding: space.lg,
		gap: space.sm
	},
	cardOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
	cardLast: { borderBottomWidth: 0 },
	cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
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
	fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	stepBtn: {
		minWidth: touchMin,
		minHeight: touchMin,
		borderRadius: radius.sm,
		backgroundColor: colors.bg,
		borderWidth: 1,
		borderColor: colors.border,
		alignItems: 'center',
		justifyContent: 'center'
	},
	stepBtnText: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: fontFamily.bold },
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
	}
	});
}
