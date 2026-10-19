import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
	Alert,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import { ChevronRight, SlidersHorizontal, Sparkles } from 'lucide-react-native';
import { buildDemoPlan } from '@repdraft/domain/onboarding';
import {
	collectPlanTargetFacets,
	createEmptyDraft,
	duplicatePlan,
	planHasTarget,
	planTargetSummary,
	resolveHomeNextPlan,
	sortPlansByUserOrder
} from '@repdraft/domain/workout';
import { PLANS_PAGE_SIZE } from '@repdraft/domain/home';
import type { WorkoutPlan } from '@repdraft/domain/types';
import { loadExerciseIndex } from '../../src/catalog/loadIndex';
import { MuscleFilterSheet } from '../../src/components/MuscleFilterSheet';
import { PageSkeleton } from '../../src/components/PageSkeleton';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { useLocale } from '../../src/state/locale';
import { useTabScreenPad } from '../../src/layout/safe';
import { useAppColors } from '../../src/state/theme';
import { readHomeNextPlanId, writeHomeNextPlanId } from '../../src/live/homeNext';
import { readPlanOrder, writePlanOrder } from '../../src/live/planOrder';
import { plansRepo } from '../../src/storage/plansRepo';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { deletePlanRemote, pushPlan } from '../../src/sync/cloudSync';
import { fontFamily, radius, space, touchMin, type, type ColorPalette } from '../../src/theme';

export default function WorkoutsTab() {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const tabPad = useTabScreenPad(space.lg);
	const [plans, setPlans] = useState<WorkoutPlan[]>([]);
	const [recentPlanId, setRecentPlanId] = useState<string | null>(null);
	const [pinnedNextId, setPinnedNextId] = useState<string | null>(null);
	const [planOrder, setPlanOrder] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [plansVisibleLimit, setPlansVisibleLimit] = useState(PLANS_PAGE_SIZE);
	const [muscleFilter, setMuscleFilter] = useState('');
	const [muscleSheetOpen, setMuscleSheetOpen] = useState(false);

	const reload = useCallback(async () => {
		const [list, sessions, order, pinned] = await Promise.all([
			plansRepo.list(),
			sessionsRepo.list(),
			readPlanOrder(),
			readHomeNextPlanId()
		]);
		const ordered = sortPlansByUserOrder(list, order);
		const nextOrder = order.length > 0 ? order : ordered.map((p) => p.id);
		if (order.length === 0 && ordered.length > 0) {
			await writePlanOrder(nextOrder);
		}
		const lastFinished = sessions.find((s) => s.finishedAt && s.planId);
		setPlanOrder(nextOrder);
		setPlans(ordered);
		setRecentPlanId(lastFinished?.planId ?? null);
		setPinnedNextId(pinned);
		setLoading(false);
	}, []);

	useFocusEffect(
		useCallback(() => {
			void reload();
		}, [reload])
	);

	async function createBlank() {
		try {
			const plan = createEmptyDraft(tt('workouts.newName'));
			await plansRepo.save(plan);
			const check = await plansRepo.get(plan.id);
			if (!check) {
				Alert.alert(tt('builder.saveFail'));
				return;
			}
			router.push(`/builder/${plan.id}`);
		} catch {
			Alert.alert(tt('builder.saveFail'));
		}
	}

	async function quickStart() {
		try {
			const plan = buildDemoPlan(tt('workouts.quick'));
			await plansRepo.save(plan);
			router.push(`/plan/${plan.id}`);
		} catch {
			Alert.alert(tt('builder.saveFail'));
		}
	}

	async function duplicate(plan: WorkoutPlan) {
		const copy = duplicatePlan(plan);
		await plansRepo.save(copy);
		try {
			await pushPlan(copy);
		} catch {
			/* offline */
		}
		router.push(`/builder/${copy.id}`);
	}

	async function movePlan(plan: WorkoutPlan, direction: -1 | 1) {
		const idx = planOrder.indexOf(plan.id);
		if (idx < 0) return;
		const nextIdx = idx + direction;
		if (nextIdx < 0 || nextIdx >= planOrder.length) return;
		const next = [...planOrder];
		[next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
		await writePlanOrder(next);
		void reload();
	}

	function confirmDelete(plan: WorkoutPlan) {
		Alert.alert(tt('records.delete'), plan.name || tt('workouts.duplicate'), [
			{ text: tt('common.cancel'), style: 'cancel' },
			{
				text: tt('records.delete'),
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await plansRepo.remove(plan.id);
						try {
							await deletePlanRemote(plan.id);
						} catch {
							/* offline */
						}
						void reload();
					})();
				}
			}
		]);
	}

	const next = useMemo(
		() => resolveHomeNextPlan(plans, recentPlanId, pinnedNextId),
		[plans, recentPlanId, pinnedNextId]
	);
	const indexById = useMemo(
		() => new Map(loadExerciseIndex().map((item) => [item.id, item] as const)),
		[]
	);
	const muscleFacets = useMemo(
		() => collectPlanTargetFacets(plans, indexById, locale),
		[plans, indexById, locale]
	);
	const filteredPlans = useMemo(() => {
		let list = plans;
		const q = searchQuery.trim().toLowerCase();
		if (q) list = list.filter((p) => (p.name ?? '').toLowerCase().includes(q));
		if (muscleFilter) list = list.filter((p) => planHasTarget(p, indexById, muscleFilter));
		return list;
	}, [plans, searchQuery, muscleFilter, indexById]);
	const visiblePlans = useMemo(
		() => filteredPlans.slice(0, plansVisibleLimit),
		[filteredPlans, plansVisibleLimit]
	);
	const filtersActive = searchQuery.trim().length > 0 || muscleFilter !== '';
	const searchActive = searchQuery.trim().length > 0;
	const hasPlans = plans.length > 0;

	function loadMorePlans() {
		if (plansVisibleLimit >= filteredPlans.length) return;
		setPlansVisibleLimit(Math.min(filteredPlans.length, plansVisibleLimit + PLANS_PAGE_SIZE));
	}

	function clearFilters() {
		setSearchQuery('');
		setMuscleFilter('');
		setPlansVisibleLimit(PLANS_PAGE_SIZE);
	}

	if (loading && plans.length === 0) {
		return <PageSkeleton variant="home" />;
	}

	return (
		<View style={styles.root}>
			<FlatList
				style={styles.flexList}
				data={visiblePlans}
				keyExtractor={(item) => item.id}
				ListHeaderComponent={
					<View style={styles.headerWrap}>
						<Text style={styles.leadHint}>{tt('workouts.lead')}</Text>
						{hasPlans ? (
							<View style={styles.filterRow}>
								<TextInput
									value={searchQuery}
									onChangeText={(v) => {
										setSearchQuery(v);
										setPlansVisibleLimit(PLANS_PAGE_SIZE);
									}}
									placeholder={tt('workouts.searchPh')}
									placeholderTextColor={colors.muted}
									style={styles.search}
									autoCapitalize="none"
									autoCorrect={false}
									clearButtonMode="while-editing"
								/>
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={tt('workouts.muscleFilter')}
									style={({ pressed }) => [
										styles.filterBtn,
										(muscleFilter || searchQuery.trim()) && styles.filterBtnActive,
										pressed && styles.pressed
									]}
									onPress={() => setMuscleSheetOpen(true)}
								>
									<SlidersHorizontal color={colors.text} size={20} strokeWidth={2} />
								</Pressable>
							</View>
						) : null}
						{filtersActive ? (
							<Pressable accessibilityRole="button" style={styles.clearFiltersRow} onPress={clearFilters}>
								<Text style={styles.clearFiltersText}>{tt('workouts.historyClearFiltersAria')}</Text>
							</Pressable>
						) : null}
						<View style={styles.rowActions}>
							<View style={styles.flex}>
								<PrimaryButton label={tt('workouts.create')} onPress={() => void createBlank()} />
							</View>
							<View style={styles.flex}>
								<PrimaryButton
									label={tt('workouts.quick')}
									variant="ghost"
									onPress={() => void quickStart()}
								/>
							</View>
						</View>
					</View>
				}
				ListEmptyComponent={
					<Text style={styles.empty}>
						{searchActive ? tt('builder.noMatches') : tt('workouts.empty')}
					</Text>
				}
				onEndReached={loadMorePlans}
				onEndReachedThreshold={0.5}
				contentContainerStyle={[styles.list, { paddingBottom: tabPad }]}
				renderItem={({ item }) => (
					<SwipeableRow deleteLabel={tt('workouts.delete')} onDelete={() => confirmDelete(item)}>
						<Pressable
							accessibilityRole="button"
							style={({ pressed }) => [
								styles.row,
								next?.id === item.id && styles.rowNext,
								pressed && styles.pressed
							]}
							onPress={() => router.push(`/plan/${item.id}`)}
							onLongPress={() => {
								Alert.alert(item.name || tt('workouts.duplicate'), undefined, [
									{ text: tt('common.cancel'), style: 'cancel' },
									{
										text: tt('workouts.pinNext'),
										onPress: () => {
											void writeHomeNextPlanId(item.id).then(() => {
												Alert.alert(
													tt('common.ok'),
													tt('home.setNextPlanDone', {
														name: item.name || tt('workouts.duplicate')
													})
												);
												return reload();
											});
										}
									},
									{ text: tt('workouts.duplicate'), onPress: () => void duplicate(item) },
									{ text: tt('workouts.moveUp'), onPress: () => void movePlan(item, -1) },
									{ text: tt('workouts.moveDown'), onPress: () => void movePlan(item, 1) }
								]);
							}}
						>
							<View style={styles.rowBody}>
								<Text style={styles.rowTitle} numberOfLines={2}>
									{item.name || '-'}
								</Text>
								<Text style={styles.rowMeta} numberOfLines={1}>
									{item.exercises.length} {tt('common.exercises')}
									{(() => {
										const summary = planTargetSummary(item, indexById, locale);
										return summary ? ` · ${summary}` : '';
									})()}
									{next?.id === item.id ? ` · ${tt('workouts.nextBadge')}` : ''}
								</Text>
							</View>
							<Text style={styles.dupHint}>{tt('workouts.longPress')}</Text>
						</Pressable>
					</SwipeableRow>
				)}
				ListFooterComponent={
					<Pressable
						accessibilityRole="button"
						style={({ pressed }) => [styles.aiRow, pressed && styles.pressed]}
						onPress={() => router.push('/ai')}
					>
						<Sparkles color={colors.muted} size={18} strokeWidth={2.25} />
						<Text style={styles.aiRowText}>{tt('ai.open')}</Text>
						<ChevronRight color={colors.muted} size={16} strokeWidth={2.25} />
					</Pressable>
				}
			/>
			<MuscleFilterSheet
				open={muscleSheetOpen}
				selected={muscleFilter}
				targets={muscleFacets}
				onSelect={(target) => {
					setMuscleFilter(target);
					setPlansVisibleLimit(PLANS_PAGE_SIZE);
				}}
				onClear={() => {
					setMuscleFilter('');
					setPlansVisibleLimit(PLANS_PAGE_SIZE);
				}}
				onDismiss={() => setMuscleSheetOpen(false)}
			/>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		flexList: { flex: 1 },
		list: { flexGrow: 1, padding: space.lg, gap: space.sm },
		headerWrap: { gap: space.md, paddingBottom: space.sm },
		leadHint: { ...type.meta, color: colors.muted },
		pressed: { opacity: 0.85 },
		search: {
			flex: 1,
			minHeight: touchMin,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel,
			color: colors.text,
			paddingHorizontal: space.md,
			fontSize: 16,
			fontFamily: fontFamily.regular
		},
		rowActions: { flexDirection: 'row', gap: space.sm },
		flex: { flex: 1 },
		empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
		row: {
			minHeight: touchMin + 8,
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			paddingHorizontal: space.lg,
			paddingVertical: space.md,
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm
		},
		rowBody: { flex: 1 },
		rowTitle: { color: colors.text, fontSize: 17, fontWeight: '700', fontFamily: fontFamily.bold },
		rowMeta: { color: colors.muted, marginTop: 4, fontSize: 13, fontFamily: fontFamily.medium },
		rowNext: { borderColor: colors.accent, backgroundColor: colors.accentDim },
		dupHint: {
			color: colors.muted,
			fontSize: 11,
			fontWeight: '600',
			maxWidth: 72,
			textAlign: 'right',
			fontFamily: fontFamily.semibold
		},
		aiRow: {
			minHeight: touchMin,
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			paddingHorizontal: space.lg,
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			marginTop: space.xs
		},
		aiRowText: { ...type.body, color: colors.text, flex: 1 },
		filterRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
		filterBtn: {
			minHeight: touchMin,
			minWidth: touchMin,
			alignItems: 'center',
			justifyContent: 'center',
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel
		},
		filterBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
		clearFiltersRow: { minHeight: touchMin, justifyContent: 'center' },
		clearFiltersText: {
			color: colors.accentLink,
			fontWeight: '700',
			fontSize: 13,
			fontFamily: fontFamily.bold
		}
	});
}
