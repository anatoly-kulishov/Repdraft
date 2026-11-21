import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View
} from 'react-native';
import { Check } from 'lucide-react-native';
import { ATHLETE_GOAL_IDS, type AthleteGoalId } from '@repdraft/domain/athleteProfile';
import {
	CYCLE_LENGTHS,
	cycleProgressNow,
	cycleWeekPlanRows,
	defaultCycleStartDate,
	type CycleLength
} from '@repdraft/domain/cycle';
import { clampPlanName } from '@repdraft/domain/inputLimits';
import { planExerciseSlotCount } from '@repdraft/domain/workout';
import { translatePlural } from '@repdraft/i18n/messages';
import { AppInput } from '../src/components/AppInput';
import { Chip } from '../src/components/Chip';
import { ConfirmSheet } from '../src/components/ConfirmSheet';
import { EmptyState } from '../src/components/EmptyState';
import { PageSkeleton } from '../src/components/PageSkeleton';
import { Panel } from '../src/components/Panel';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { CycleWaveChart } from '../src/cycle/CycleWaveChart';
import { createEmptyDraft } from '@repdraft/domain/workout';
import { useCycleScreen } from '../src/cycle/useCycleScreen';
import { useBottomChromePad } from '../src/layout/safe';
import { useLocale } from '../src/state/locale';
import { getAthleteProfile } from '../src/state/prefs';
import { plansRepo } from '../src/storage/plansRepo';
import { useAppColors } from '../src/state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../src/theme';

export default function CycleScreen() {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const screen = useCycleScreen();

	const [draftName, setDraftName] = useState('');
	const [draftGoal, setDraftGoal] = useState<AthleteGoalId>('muscle');
	const [draftWeeks, setDraftWeeks] = useState<CycleLength>(10);
	const [draftPlanIds, setDraftPlanIds] = useState<string[]>([]);
	const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
	const [resetOpen, setResetOpen] = useState(false);

	const cycle = screen.cycle;

	/* Web seeds the draft goal from the athlete profile; a hard-coded 'muscle' ignored intake. */
	useEffect(() => {
		let cancelled = false;
		void getAthleteProfile().then((profile) => {
			const goal = profile.goals[0];
			if (!cancelled && goal) setDraftGoal(goal);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	async function createPlanForCycle() {
		try {
			const plan = createEmptyDraft(tt('workouts.newName'));
			await plansRepo.save(plan);
			router.push(`/builder/${plan.id}`);
		} catch {
			Alert.alert(tt('common.error'), tt('builder.saveFail'));
		}
	}
	const currentWeek = screen.progress?.week ?? 1;
	const openWeek = expandedWeek;

	// Collapse/expand must work for the current week too, so seed the open week
	// once per loaded cycle instead of falling back at render time.
	useEffect(() => {
		if (!cycle) {
			setExpandedWeek(null);
			return;
		}
		setExpandedWeek(cycleProgressNow(cycle).week);
	}, [cycle]);

	const startDateLabel = useMemo(() => {
		const date = new Date(`${defaultCycleStartDate()}T00:00:00`);
		return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date);
	}, [locale]);

	function togglePlan(planId: string) {
		setDraftPlanIds((prev) =>
			prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
		);
	}

	async function onCreate() {
		if (draftPlanIds.length === 0) return;
		await screen.create({
			name: clampPlanName(draftName.trim()),
			goal: draftGoal,
			weeks: draftWeeks,
			planIds: draftPlanIds
		});
		setDraftName('');
	}

	async function onReset() {
		setResetOpen(false);
		setDraftPlanIds([]);
		setExpandedWeek(null);
		await screen.reset();
	}

	if (screen.loading) {
		return <PageSkeleton variant="home" />;
	}

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<Text style={styles.lead}>{tt('cycle.lead')}</Text>

			{!cycle ? (
				screen.plans.length === 0 ? (
					<EmptyState
						title={tt('cycle.plansEmpty')}
						description={tt('cycle.createHint')}
						actionLabel={tt('cycle.plansEmptyCta')}
						onAction={() => void createPlanForCycle()}
					/>
				) : (
					<Panel style={styles.setup}>
						<Text style={styles.setupLead}>{tt('cycle.createHint')}</Text>

						<View style={styles.field}>
							<Text style={styles.fieldLabel}>{tt('cycle.nameLabel')}</Text>
							<AppInput
								value={draftName}
								onChangeText={setDraftName}
								maxLength={48}
								placeholder={tt('cycle.namePlaceholder')}
							/>
						</View>

						<View style={styles.field}>
							<Text style={styles.fieldLabel}>{tt('cycle.goalLabel')}</Text>
							<View style={styles.chips}>
								{ATHLETE_GOAL_IDS.map((goal) => (
									<Chip
										key={goal}
										label={tt(`intake.goal.${goal}`)}
										selected={draftGoal === goal}
										onPress={() => setDraftGoal(goal)}
									/>
								))}
							</View>
						</View>

						<View style={styles.field}>
							<Text style={styles.fieldLabel}>{tt('cycle.lengthLabel')}</Text>
							<View style={styles.chips}>
								{CYCLE_LENGTHS.map((weeks) => (
									<Chip
										key={weeks}
										label={tt('cycle.weeksShort', { n: weeks })}
										selected={draftWeeks === weeks}
										onPress={() => setDraftWeeks(weeks)}
									/>
								))}
							</View>
						</View>

						<View style={styles.field}>
							<Text style={styles.fieldLabel}>{tt('cycle.plansLabel')}</Text>
							<Text style={styles.hint}>{tt('cycle.plansHint')}</Text>
							<View style={styles.planList}>
								{screen.plans.map((plan) => {
									const order = draftPlanIds.indexOf(plan.id);
									const selected = order >= 0;
									return (
										<Pressable
											key={plan.id}
											accessibilityRole="button"
											accessibilityState={{ selected }}
											onPress={() => togglePlan(plan.id)}
											style={[styles.planRow, selected && styles.planRowActive]}
										>
											<View style={[styles.orderBadge, selected && styles.orderBadgeOn]}>
												{selected ? (
													<Text style={styles.orderBadgeText}>{order + 1}</Text>
												) : null}
											</View>
											<View style={styles.planRowBody}>
												<Text style={styles.planRowName} numberOfLines={1}>
													{plan.name}
												</Text>
												<Text style={styles.planRowMeta}>
													{translatePlural(locale, 'home.pillExercises', planExerciseSlotCount(plan))}
												</Text>
											</View>
											{selected ? <Check color={colors.accentText} size={18} /> : null}
										</Pressable>
									);
								})}
							</View>
							{draftPlanIds.length > 0 ? (
								<Text style={styles.hint}>
									{tt('cycle.selected', { n: draftPlanIds.length })}
								</Text>
							) : null}
						</View>

						<Text style={styles.hint}>
							{tt('cycle.startLabel')}: {tt('cycle.startValue', { date: startDateLabel })}
						</Text>

						<PrimaryButton
							label={tt('cycle.createCta')}
							disabled={draftPlanIds.length === 0}
							onPress={() => void onCreate()}
						/>
						<Text style={styles.localHint}>{tt('cycle.localHint')}</Text>
					</Panel>
				)
			) : (
				<>
					<Panel style={styles.summary}>
						<Text style={styles.eyebrow}>
							{tt(`intake.goal.${cycle.goal}`)} · {tt('cycle.weeksShort', { n: cycle.weeks })}
						</Text>
						<Text style={styles.summaryTitle}>{cycle.name}</Text>
						<View style={styles.weekRow}>
							<Text style={styles.weekText}>
								{tt('cycle.cardWeek', { week: currentWeek, total: cycle.weeks })}
							</Text>
							<Text style={styles.kindChip}>
								{tt(`cycle.kind.${screen.weeks[currentWeek - 1]?.kind ?? 'volume'}`)}
							</Text>
						</View>
						<View
							style={styles.bar}
							accessibilityRole="progressbar"
							accessibilityValue={{
								min: 0,
								max: screen.totalPlanned,
								now: screen.totalDone
							}}
							accessibilityLabel={tt('cycle.totalDone', {
								done: screen.totalDone,
								planned: screen.totalPlanned
							})}
						>
							<View
								style={[
									styles.barFill,
									{
										width: `${
											screen.totalPlanned > 0
												? Math.round((screen.totalDone / screen.totalPlanned) * 100)
												: 0
										}%`
									}
								]}
							/>
						</View>
						<Text style={styles.hint}>
							{tt('cycle.totalDone', {
								done: screen.totalDone,
								planned: screen.totalPlanned
							})}
						</Text>
						{screen.progress?.done ? (
							<View style={styles.finished}>
								<Text style={styles.finishedTitle}>{tt('cycle.finishedTitle')}</Text>
								<Text style={styles.hint}>{tt('cycle.finishedHint')}</Text>
							</View>
						) : null}
					</Panel>

					<Panel style={styles.chartPanel}>
						<View style={styles.legend}>
							<View style={styles.legendItem}>
								<View style={[styles.swatch, { backgroundColor: colors.chartVolume }]} />
								<Text style={styles.hint}>{tt('cycle.legendVolume')}</Text>
							</View>
							<View style={styles.legendItem}>
								<View style={[styles.swatch, { backgroundColor: colors.accent }]} />
								<Text style={styles.hint}>{tt('cycle.legendIntensity')}</Text>
							</View>
						</View>
						<CycleWaveChart
							weeks={screen.weeks}
							label={tt('cycle.chartLabel', { n: cycle.weeks })}
						/>
					</Panel>

					<View style={styles.weekList}>
						{screen.weeks.map((week) => {
							const open = openWeek === week.week;
							const rows = open
								? cycleWeekPlanRows(cycle, week.week, screen.plans, screen.history)
								: [];
							return (
								<View
									key={week.week}
									style={[styles.weekCard, week.isCurrent && styles.weekCardNow]}
								>
									<Pressable
										accessibilityRole="button"
										accessibilityState={{ expanded: open }}
										onPress={() => setExpandedWeek(open ? null : week.week)}
										style={styles.weekHead}
									>
										<View style={styles.weekHeadBody}>
											<View style={styles.weekTitleRow}>
												<Text style={styles.weekTitle}>
													{tt('cycle.weekRow', { week: week.week })}
												</Text>
												<Text style={styles.weekKind}>{tt(`cycle.kind.${week.kind}`)}</Text>
											</View>
											<Text style={styles.hint}>
												{tt('cycle.waveMeta', {
													volume: week.volumePct,
													intensity: week.intensityPct
												})}
											</Text>
										</View>
										<Text style={[styles.weekDone, week.isCurrent && styles.weekDoneNow]}>
											{tt('cycle.doneOf', { done: week.done, planned: week.planned })}
										</Text>
									</Pressable>
									{open ? (
										<View style={styles.weekPlans}>
											{rows.map((row) => {
												const plan = screen.plans.find((item) => item.id === row.planId);
												return (
													<View key={row.planId} style={styles.planSlot}>
														<Text style={styles.planSlotName} numberOfLines={1}>
															{row.planName}
														</Text>
														{row.done ? (
															<View style={styles.planDone}>
																<Check color={colors.success} size={16} />
																<Text style={styles.planDoneText}>{tt('cycle.donePlan')}</Text>
															</View>
														) : plan ? (
															<View style={styles.planStart}>
																<PrimaryButton
																	compact
																	variant="secondary"
																	label={tt('cycle.start')}
																	disabled={screen.busyPlanId !== null}
																	onPress={() => void screen.startWeek(plan, week.week)}
																/>
															</View>
														) : null}
													</View>
												);
											})}
										</View>
									) : null}
								</View>
							);
						})}
					</View>

					<View style={styles.footer}>
						<PrimaryButton
							variant="secondary"
							label={tt('cycle.reset')}
							onPress={() => setResetOpen(true)}
						/>
						<Text style={styles.localHint}>{tt('cycle.localHint')}</Text>
					</View>
				</>
			)}

			<ConfirmSheet
				open={resetOpen}
				title={tt('cycle.resetTitle')}
				message={tt('cycle.resetHint')}
				onDismiss={() => setResetOpen(false)}
				actions={[
					{
						label: tt('cycle.resetConfirm'),
						variant: 'danger',
						onPress: () => void onReset()
					}
				]}
			/>
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: space.lg },
		lead: {
			color: colors.muted,
			fontSize: 14,
			lineHeight: 20,
			fontFamily: fontFamily.regular
		},
		setup: { gap: space.md },
		setupLead: { color: colors.muted, fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular },
		field: { gap: space.sm },
		fieldLabel: {
			color: colors.muted,
			fontSize: 12,
			fontWeight: '600',
			letterSpacing: 0.4,
			textTransform: 'uppercase',
			fontFamily: fontFamily.semibold
		},
		chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
		hint: {
			color: colors.mutedSoft,
			fontSize: 13,
			lineHeight: 18,
			fontFamily: fontFamily.regular
		},
		localHint: {
			color: colors.mutedSoft,
			fontSize: 12,
			lineHeight: 16,
			textAlign: 'center',
			fontFamily: fontFamily.regular
		},
		planList: { gap: space.sm },
		planRow: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.md,
			minHeight: touchMin + 8,
			paddingHorizontal: space.md,
			paddingVertical: space.sm,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panelRaised
		},
		planRowActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
		orderBadge: {
			width: 24,
			height: 24,
			borderRadius: 12,
			borderWidth: 1,
			borderStyle: 'dashed',
			borderColor: colors.border,
			alignItems: 'center',
			justifyContent: 'center'
		},
		orderBadgeOn: { borderStyle: 'solid', borderColor: colors.accent, backgroundColor: colors.accent },
		orderBadgeText: {
			color: colors.accentInk,
			fontSize: 12,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		planRowBody: { flex: 1, minWidth: 0, gap: 2 },
		planRowName: {
			color: colors.text,
			fontSize: 15,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		planRowMeta: { color: colors.muted, fontSize: 12, fontFamily: fontFamily.regular },
		summary: { gap: space.xs },
		eyebrow: {
			color: colors.muted,
			fontSize: 12,
			fontWeight: '600',
			letterSpacing: 0.4,
			textTransform: 'uppercase',
			fontFamily: fontFamily.semibold
		},
		summaryTitle: {
			color: colors.text,
			fontSize: 22,
			lineHeight: 27,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		weekRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
		weekText: {
			color: colors.text,
			fontSize: 15,
			fontFamily: fontFamily.semibold,
			fontWeight: '600'
		},
		kindChip: {
			color: colors.accentText,
			backgroundColor: colors.accentDim,
			fontSize: 12,
			fontWeight: '600',
			fontFamily: fontFamily.semibold,
			paddingHorizontal: space.sm,
			paddingVertical: 2,
			borderRadius: radius.pill
		},
		bar: {
			height: 8,
			borderRadius: radius.pill,
			backgroundColor: colors.panelRaised,
			overflow: 'hidden',
			marginTop: space.xs
		},
		barFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accent },
		finished: {
			marginTop: space.sm,
			padding: space.md,
			borderRadius: radius.md,
			backgroundColor: colors.panelRaised,
			gap: 2
		},
		finishedTitle: {
			color: colors.text,
			fontSize: 15,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		chartPanel: { gap: space.sm },
		legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
		legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
		swatch: { width: 14, height: 4, borderRadius: radius.pill },
		weekList: { gap: space.sm },
		weekCard: {
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel,
			overflow: 'hidden'
		},
		weekCardNow: { borderColor: colors.accent },
		weekHead: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.md,
			minHeight: touchMin + 8,
			padding: space.md
		},
		weekHeadBody: { flex: 1, minWidth: 0, gap: 2 },
		weekTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
		weekTitle: {
			color: colors.text,
			fontSize: 15,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		weekKind: {
			color: colors.muted,
			fontSize: 11,
			fontWeight: '600',
			letterSpacing: 0.4,
			textTransform: 'uppercase',
			fontFamily: fontFamily.semibold
		},
		weekDone: {
			color: colors.muted,
			fontSize: 13,
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.medium
		},
		weekDoneNow: { color: colors.accentText, fontWeight: '600' },
		weekPlans: { gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md },
		planSlot: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			padding: space.sm,
			borderRadius: radius.md,
			backgroundColor: colors.panelRaised
		},
		planSlotName: {
			flex: 1,
			minWidth: 0,
			color: colors.text,
			fontSize: 14,
			fontWeight: '500',
			fontFamily: fontFamily.medium
		},
		planDone: { flexDirection: 'row', alignItems: 'center', gap: 4 },
		planDoneText: { color: colors.success, fontSize: 13, fontFamily: fontFamily.medium },
		planStart: { minWidth: 96 },
		footer: { gap: space.sm, marginTop: space.xs }
	});
}
