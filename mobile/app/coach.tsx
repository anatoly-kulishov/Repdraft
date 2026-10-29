import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View
} from 'react-native';
import {
	buildCoachHints,
	hideCoachPart,
	suggestPlanReplace,
	unhideCoachPart,
	type CoachHiddenMap
} from '@repdraft/domain/coachHints';
import { computeProgressOverview } from '@repdraft/domain/progressOverview';
import { labelBodyPart } from '@repdraft/domain/labels.ru';
import type { WorkoutPlan, WorkoutSession } from '@repdraft/domain/types';
import { pluralRu } from '@repdraft/i18n/plural';
import {
	exerciseDisplayName,
	getIndexItem,
	loadExerciseIndex,
	refreshCustomsCache
} from '../src/catalog/loadIndex';
import { BottomSheet } from '../src/components/BottomSheet';
import { PageSkeleton } from '../src/components/PageSkeleton';
import { Panel } from '../src/components/Panel';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { readHomeNextPlanId } from '../src/live/homeNext';
import {
	appendExerciseToPlan,
	removeExerciseFromPlan,
	replaceExerciseInHomePlan
} from '../src/lib/planPatch';
import { useBottomChromePad } from '../src/layout/safe';
import { loadCoachHidden, markCoachSeen, saveCoachHidden } from '../src/state/coachHints';
import { useLocale } from '../src/state/locale';
import { useAppColors } from '../src/state/theme';
import { plansRepo } from '../src/storage/plansRepo';
import { sessionsRepo } from '../src/storage/sessionsRepo';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../src/theme';

type Notice = {
	message: string;
	undo?: () => void | Promise<void>;
};

export default function CoachScreen() {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const [sessions, setSessions] = useState<WorkoutSession[]>([]);
	const [plans, setPlans] = useState<WorkoutPlan[]>([]);
	const [pinnedPlanId, setPinnedPlanId] = useState<string | null>(null);
	const [hidden, setHidden] = useState<CoachHiddenMap>({});
	const [loaded, setLoaded] = useState(false);
	const [hintsExpanded, setHintsExpanded] = useState(false);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [planSheetOpen, setPlanSheetOpen] = useState(false);
	const [planSheetExerciseId, setPlanSheetExerciseId] = useState<string | null>(null);
	const [planSheetBusy, setPlanSheetBusy] = useState(false);
	const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const reloadPlans = useCallback(async () => {
		const [list, pinned] = await Promise.all([plansRepo.list(), readHomeNextPlanId()]);
		setPlans(list);
		setPinnedPlanId(pinned ?? null);
	}, []);

	useFocusEffect(
		useCallback(() => {
			void markCoachSeen();
			void (async () => {
				await refreshCustomsCache();
				setSessions(await sessionsRepo.list());
				setHidden(await loadCoachHidden());
				await reloadPlans();
				setLoaded(true);
			})();
		}, [reloadPlans])
	);

	useEffect(
		() => () => {
			if (noticeTimer.current) clearTimeout(noticeTimer.current);
		},
		[]
	);

	const homePlan = useMemo(
		() => (pinnedPlanId ? plans.find((plan) => plan.id === pinnedPlanId) : null) ?? plans[0] ?? null,
		[plans, pinnedPlanId]
	);

	const overview = useMemo(
		() => computeProgressOverview(sessions, new Date(), (id) => getIndexItem(id)?.body_part ?? null),
		[sessions]
	);
	const finishedCount = useMemo(
		() => sessions.filter((session) => session.finishedAt).length,
		[sessions]
	);
	const replace = useMemo(() => {
		if (!homePlan || !overview.laggingBodyPart) return null;
		return suggestPlanReplace(
			homePlan.exercises.map((ex) => ex.exerciseId),
			[overview.laggingBodyPart],
			loadExerciseIndex(),
			(id) => getIndexItem(id)?.body_part ?? null
		);
	}, [homePlan, overview.laggingBodyPart]);

	const replaceSharePct = useMemo(
		() =>
			replace
				? (overview.bodyParts.find((part) => part.bodyPart === replace.bodyPart)?.sharePct ??
					null)
				: null,
		[replace, overview.bodyParts]
	);

	const planExerciseIds = useMemo(
		() => plans.flatMap((plan) => plan.exercises.map((ex) => ex.exerciseId)),
		[plans]
	);

	const hints = useMemo(() => {
		const finished = sessions
			.filter((s) => s.finishedAt)
			.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
		const focus = finished[0];
		if (!focus) return [];
		const catalog = loadExerciseIndex();
		const bodyPartFor = (id: string) => getIndexItem(id)?.body_part ?? null;
		return buildCoachHints(focus, finished, catalog, bodyPartFor, { planExerciseIds });
	}, [sessions, planExerciseIds]);

	const visibleHints = hints.filter((hint) => (hidden[hint.bodyPart] ?? 0) <= Date.now());
	const shownHints = hintsExpanded ? visibleHints : visibleHints.slice(0, 1);
	const laggingParts = useMemo(
		() => new Set(visibleHints.map((hint) => hint.bodyPart)),
		[visibleHints]
	);
	const balanceRows = overview.bodyParts.slice(0, 4);

	const reviewedLine = useMemo(() => {
		const n = overview.workouts30d;
		if (locale === 'ru') {
			const label = pluralRu(n, ['тренировку', 'тренировки', 'тренировок']);
			return tt('coach.reviewed', { n: `${n} ${label}` });
		}
		return tt('coach.reviewed', { n: `${n} ${n === 1 ? 'workout' : 'workouts'}` });
	}, [locale, overview.workouts30d, tt]);

	function showNotice(message: string, undo?: () => void | Promise<void>) {
		setNotice({ message, undo });
		if (noticeTimer.current) clearTimeout(noticeTimer.current);
		noticeTimer.current = setTimeout(() => setNotice(null), 6000);
	}

	async function runUndo() {
		const current = notice;
		if (!current?.undo) return;
		if (noticeTimer.current) clearTimeout(noticeTimer.current);
		setNotice(null);
		await current.undo();
	}

	async function replaceHint() {
		if (!replace) return;
		const planId = await replaceExerciseInHomePlan(replace.fromExerciseId, replace.toExerciseId);
		if (!planId) {
			Alert.alert(tt('common.error'), tt('coach.noPlan'));
			return;
		}
		router.push(`/builder/${planId}`);
	}

	function openPlanSheet(exerciseId: string) {
		setPlanSheetExerciseId(exerciseId);
		setPlanSheetOpen(true);
	}

	async function addToPlan(planId: string) {
		const exerciseId = planSheetExerciseId;
		if (!exerciseId || planSheetBusy) return;
		setPlanSheetBusy(true);
		try {
			const patch = await appendExerciseToPlan(planId, exerciseId);
			if (!patch) {
				Alert.alert(tt('common.error'), tt('coach.noPlan'));
				return;
			}
			setPlanSheetOpen(false);
			await reloadPlans();
			if (!patch.added) {
				showNotice(tt('coach.added'));
				return;
			}
			const planName =
				plans.find((plan) => plan.id === planId)?.name.trim() || tt('workouts.newName');
			showNotice(tt('coach.addedNamed', { plan: planName }), async () => {
				await removeExerciseFromPlan(planId, exerciseId);
				await reloadPlans();
			});
		} finally {
			setPlanSheetBusy(false);
		}
	}

	function hideRow(bodyPart: string) {
		setHidden((prev) => {
			const next = hideCoachPart(prev, bodyPart);
			void saveCoachHidden(next);
			return next;
		});
		showNotice(tt('coach.hidden'), () => {
			setHidden((prev) => {
				const next = unhideCoachPart(prev, bodyPart);
				void saveCoachHidden(next);
				return next;
			});
		});
	}

	if (!loaded) return <PageSkeleton variant="coach" />;

	return (
		<>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
			>
				<Text style={styles.lead}>{tt('coach.lead')}</Text>
				{overview.workouts30d > 0 ? <Text style={styles.lead}>{reviewedLine}</Text> : null}
				{notice ? (
					<View style={styles.notice}>
						<Text style={styles.noticeText}>{notice.message}</Text>
						{notice.undo ? (
							<Pressable
								accessibilityRole="button"
								hitSlop={8}
								onPress={() => void runUndo()}
							>
								<Text style={styles.noticeAction}>{tt('common.undo')}</Text>
							</Pressable>
						) : null}
					</View>
				) : null}

				{balanceRows.length > 0 ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={tt('coach.balanceTitle')}
						onPress={() => router.push('/progress')}
					>
						<Panel>
							<View style={styles.balanceHead}>
								<Text style={styles.balanceTitle}>{tt('coach.balanceTitle')}</Text>
								<Text style={styles.balanceLink}>{tt('home.progressOpen')}</Text>
							</View>
							<Text style={styles.balanceHint}>{tt('coach.balanceHint')}</Text>
							{balanceRows.map((row) => {
								const lagging = laggingParts.has(row.bodyPart);
								return (
									<View key={row.bodyPart} style={styles.balanceRow}>
										<Text
											style={[styles.balancePart, lagging && styles.balancePartActive]}
											numberOfLines={1}
										>
											{labelBodyPart(row.bodyPart, locale)}
										</Text>
										<View style={styles.balanceTrack}>
											<View
												style={[
													styles.balanceFill,
													lagging && styles.balanceFillActive,
													{ width: `${Math.max(row.sharePct, 2)}%` }
												]}
											/>
										</View>
										<Text style={styles.balancePct}>{row.sharePct}%</Text>
									</View>
								);
							})}
						</Panel>
					</Pressable>
				) : null}

				{visibleHints.length === 0 && !replace ? (
					<Panel>
						<Text style={styles.muted}>
							{tt(finishedCount === 0 ? 'coach.empty' : 'coach.nothingYet')}
						</Text>
						{finishedCount === 0 ? (
							<PrimaryButton
								label={tt('coach.emptyCta')}
								onPress={() => router.push('/')}
							/>
						) : null}
					</Panel>
				) : (
					<>
						{shownHints.map((hint) => (
							<Panel key={hint.id}>
								<Text style={styles.title}>
									{exerciseDisplayName(hint.exerciseId, locale)}
								</Text>
								<Text style={styles.meta}>
									{labelBodyPart(hint.bodyPart, locale)} ·{' '}
									{tt('coach.hintShare', { pct: hint.sharePct })}
								</Text>
								<Text style={styles.why}>{tt(hint.reasonKey)}</Text>
								<PrimaryButton
									label={tt('coach.addToPlan')}
									onPress={() => openPlanSheet(hint.exerciseId)}
								/>
								<Pressable
									accessibilityRole="button"
									style={styles.hideBtn}
									onPress={() => hideRow(hint.bodyPart)}
								>
									<Text style={styles.hideText}>{tt('coach.hideHint')}</Text>
								</Pressable>
							</Panel>
						))}
						{visibleHints.length > 1 ? (
							<Pressable
								accessibilityRole="button"
								style={styles.moreBtn}
								onPress={() => setHintsExpanded((value) => !value)}
							>
								<Text style={styles.moreText}>
									{hintsExpanded
										? tt('coach.showLess')
										: tt('coach.showMore', { n: visibleHints.length - 1 })}
								</Text>
							</Pressable>
						) : null}
						{replace ? (
							<Panel>
								<Text style={styles.title}>
									{exerciseDisplayName(replace.fromExerciseId, locale)}
								</Text>
								<Text style={styles.meta}>
									→ {exerciseDisplayName(replace.toExerciseId, locale)}
								</Text>
								<Text style={styles.meta}>
									{labelBodyPart(replace.bodyPart, locale)}
								</Text>
								<Text style={styles.why}>
									{replaceSharePct != null
										? tt('coach.replaceWhy', {
												part: labelBodyPart(replace.bodyPart, locale),
												pct: replaceSharePct
											})
										: tt('coach.replaceWhyGeneric')}
								</Text>
								<Text style={styles.why}>{tt('coach.replaceWhat')}</Text>
								<PrimaryButton
									label={tt('coach.replace')}
									onPress={() => void replaceHint()}
								/>
							</Panel>
						) : null}
					</>
				)}
			</ScrollView>

			<BottomSheet
				open={planSheetOpen}
				onDismiss={() => setPlanSheetOpen(false)}
				label={tt('coach.addToPlan')}
				dismissible={!planSheetBusy}
			>
				<Text style={styles.sheetTitle}>{tt('coach.addToPlan')}</Text>
				{plans.length === 0 ? (
					<Text style={styles.muted}>{tt('coach.assignEmpty')}</Text>
				) : (
					<ScrollView style={styles.planScroll} keyboardShouldPersistTaps="handled">
						{plans.map((plan) => {
							const hasExercise = planSheetExerciseId
								? plan.exercises.some((ex) => ex.exerciseId === planSheetExerciseId)
								: false;
							return (
								<Pressable
									key={plan.id}
									accessibilityRole="button"
									disabled={hasExercise || planSheetBusy}
									style={styles.planRow}
									onPress={() => void addToPlan(plan.id)}
								>
									<Text style={styles.planName} numberOfLines={1}>
										{plan.name || tt('workouts.newName')}
									</Text>
									<Text style={styles.planMeta}>
										{hasExercise
											? tt('coach.planHasExercise')
											: tt('coach.assignExercises', {
													n: plan.exercises.length
												})}
									</Text>
								</Pressable>
							);
						})}
					</ScrollView>
				)}
			</BottomSheet>
		</>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: space.md },
		lead: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: fontFamily.regular },
		title: { color: colors.text, fontWeight: '800', fontSize: 17, fontFamily: fontFamily.extrabold },
		meta: { color: colors.muted, fontSize: 14, fontFamily: fontFamily.regular },
		why: {
			color: colors.muted,
			fontSize: 13,
			lineHeight: 18,
			fontFamily: fontFamily.regular
		},
		notice: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.md,
			paddingHorizontal: space.md,
			paddingVertical: space.sm,
			borderRadius: radius.md,
			backgroundColor: colors.panelRaised
		},
		noticeText: { flex: 1, color: colors.text, fontSize: 13, fontFamily: fontFamily.regular },
		noticeAction: { color: colors.accentText, fontSize: 13, fontFamily: fontFamily.semibold },
		muted: { color: colors.muted, lineHeight: 20, fontFamily: fontFamily.regular },
		balanceHead: {
			flexDirection: 'row',
			alignItems: 'baseline',
			justifyContent: 'space-between',
			gap: space.sm
		},
		balanceTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semibold },
		balanceLink: { color: colors.accentText, fontSize: 13, fontFamily: fontFamily.semibold },
		balanceHint: { color: colors.muted, fontSize: 12, lineHeight: 16, fontFamily: fontFamily.regular },
		balanceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
		balancePart: { width: 96, color: colors.muted, fontSize: 13, fontFamily: fontFamily.regular },
		balancePartActive: { color: colors.text, fontFamily: fontFamily.semibold },
		balanceTrack: {
			flex: 1,
			height: 6,
			borderRadius: 999,
			backgroundColor: colors.border,
			overflow: 'hidden'
		},
		balanceFill: { height: '100%', borderRadius: 999, backgroundColor: colors.muted },
		balanceFillActive: { backgroundColor: colors.accent },
		balancePct: {
			width: 38,
			textAlign: 'right',
			color: colors.muted,
			fontSize: 13,
			fontFamily: fontFamily.medium
		},
		hideBtn: {
			minHeight: touchMin,
			alignItems: 'center',
			justifyContent: 'center'
		},
		hideText: { color: colors.muted, fontSize: 13, fontFamily: fontFamily.medium },
		moreBtn: {
			minHeight: touchMin,
			alignItems: 'center',
			justifyContent: 'center',
			borderRadius: radius.md,
			backgroundColor: colors.panel
		},
		moreText: { color: colors.accentText, fontSize: 14, fontFamily: fontFamily.semibold },
		sheetTitle: {
			color: colors.text,
			fontSize: 18,
			lineHeight: 24,
			fontFamily: fontFamily.semibold
		},
		planScroll: { maxHeight: 360 },
		planRow: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			paddingHorizontal: space.sm,
			borderRadius: radius.sm
		},
		planName: {
			flex: 1,
			color: colors.text,
			fontSize: 15,
			fontFamily: fontFamily.semibold
		},
		planMeta: { color: colors.muted, fontSize: 12, fontFamily: fontFamily.regular }
	});
}
