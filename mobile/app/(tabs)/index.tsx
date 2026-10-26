import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, NotebookPen, Smartphone, UserRound } from 'lucide-react-native';
import {
	dayGreetingPeriod,
	homeGreetingMessageKey
} from '@repdraft/domain/greeting';
import { greetingFirstName } from '@repdraft/domain/greetingName';
import {
	shouldShowChecklist,
	type OnboardingState
} from '@repdraft/domain/onboarding';
import {
	completedExerciseCount,
	completedSetCount,
	isSessionFullyLogged,
	sessionDurationMs,
	totalSetCount
} from '@repdraft/domain/session';
import {
	createEmptyDraft,
	planExerciseSlotCount,
	planTargetSummary,
	resolveHomeNextPlan,
	sortPlansByUserOrder
} from '@repdraft/domain/workout';
import { progress30d } from '@repdraft/domain/progressOverview';
import type { WorkoutPlan, WorkoutSession } from '@repdraft/domain/types';
import { loadExerciseIndex } from '../../src/catalog/loadIndex';
import { OnboardingChecklistPanel } from '../../src/components/OnboardingChecklistPanel';
import { PageSkeleton } from '../../src/components/PageSkeleton';
import { Panel } from '../../src/components/Panel';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { getSupabase, isSupabaseConfigured } from '../../src/auth/supabase';
import { formatRelativeDay } from '@repdraft/i18n/format';
import { readHomeNextPlanId } from '../../src/live/homeNext';
import { readPlanOrder, writePlanOrder } from '../../src/live/planOrder';
import { loadGreetingName } from '../../src/state/greetingName';
import { useLocale } from '../../src/state/locale';
import { useTabScreenPad } from '../../src/layout/safe';
import { useAppColors } from '../../src/state/theme';
import { dismissChecklist, noteChecklist } from '../../src/state/onboarding';
import { plansRepo } from '../../src/storage/plansRepo';
import { readActiveSession, sessionsRepo } from '../../src/storage/sessionsRepo';
import { outboxCount } from '../../src/sync/cloudSync';
import { fontFamily, radius, space, touchMin, type, type ColorPalette } from '../../src/theme';

const RECENT_LIMIT = 3;

function sessionMinutes(session: WorkoutSession): number {
	return Math.max(1, Math.round((sessionDurationMs(session) ?? 60_000) / 60_000));
}

export default function WorkoutsScreen() {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const tabPad = useTabScreenPad(space.lg);
	const [plans, setPlans] = useState<WorkoutPlan[]>([]);
	const [active, setActive] = useState<WorkoutSession | null>(null);
	const [recent, setRecent] = useState<WorkoutSession[]>([]);
	const [monthly, setMonthly] = useState<{ workouts: number; volumeKg: number } | null>(null);
	const [pinnedNextId, setPinnedNextId] = useState<string | null>(null);
	const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
	const [greetingCustom, setGreetingCustom] = useState('');
	const [authUser, setAuthUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [pendingSync, setPendingSync] = useState(0);

	const reload = useCallback(async () => {
		setLoading(true);
		const [list, activeSession, sessions, order, pinned, outbox] = await Promise.all([
			plansRepo.list(),
			readActiveSession(),
			sessionsRepo.list(),
			readPlanOrder(),
			readHomeNextPlanId(),
			outboxCount()
		]);
		const nextOb = await noteChecklist('homeSeen');
		const lastFinished = sessions.find((s) => s.finishedAt && s.planId);
		const ordered = sortPlansByUserOrder(list, order);
		const nextOrder = order.length > 0 ? order : ordered.map((p) => p.id);
		if (order.length === 0 && ordered.length > 0) {
			await writePlanOrder(nextOrder);
		}
		setPlans(ordered);
		setActive(activeSession && !activeSession.finishedAt ? activeSession : null);
		setRecent(
			sessions
				.filter((s) => s.finishedAt)
				.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
				.slice(0, RECENT_LIMIT)
		);
		setMonthly(progress30d(sessions, new Date()));
		setPinnedNextId(pinned);
		setOnboarding(nextOb);
		const sb = getSupabase();
		const user = sb ? (await sb.auth.getSession()).data.session?.user ?? null : null;
		setAuthUser(user);
		setGreetingCustom(await loadGreetingName(user));
		setPendingSync(outbox);
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

	const next = useMemo(
		() =>
			resolveHomeNextPlan(
				plans,
				recent[0]?.planId ?? null,
				pinnedNextId
			),
		[plans, recent, pinnedNextId]
	);
	const indexById = useMemo(
		() => new Map(loadExerciseIndex().map((item) => [item.id, item] as const)),
		[]
	);
	const showChecklist = onboarding ? shouldShowChecklist(onboarding) : false;
	const heroMeta = useMemo(() => {
		if (!next) return null;
		return {
			exercises: planExerciseSlotCount(next),
			summary: planTargetSummary(next, indexById, locale)
		};
	}, [next, indexById, locale]);
	const greetingName = greetingFirstName(greetingCustom, authUser);
	const greeting = tt(
		homeGreetingMessageKey(dayGreetingPeriod(), Boolean(greetingName)),
		greetingName ? { name: greetingName } : undefined
	);
	const isGuest = isSupabaseConfigured() && !authUser;
	const hasPlans = plans.length > 0;
	const hasRecent = recent.length > 0;
	const showGuestHero = isGuest && !hasPlans && !hasRecent && !active;

	const continueMeta = useMemo(() => {
		if (!active) return null;
		if (isSessionFullyLogged(active)) return tt('home.remainingFinishReady');
		return tt('home.remainingProgress', {
			exercises: Math.max(0, active.exercises.length - completedExerciseCount(active)),
			sets: Math.max(0, totalSetCount(active) - completedSetCount(active))
		});
	}, [active, tt]);

	if (loading) {
		return <PageSkeleton variant="home" />;
	}

	const header = (
		<View style={styles.headerWrap}>
			<View style={styles.headerRow}>
				<Text style={styles.greeting} numberOfLines={1}>
					{greeting}
				</Text>
			</View>
		{pendingSync > 0 ? (
			<Panel style={styles.syncBanner}>
				<Text style={styles.syncBannerText}>
					{tt('profile.outbox', { n: pendingSync })}
				</Text>
			</Panel>
		) : null}

			{active && continueMeta ? (
				<Panel accent style={styles.card}>
					<Text style={styles.eyebrow}>{tt('home.workoutInProgress')}</Text>
					<Text style={styles.cardTitle} numberOfLines={2}>
						{active.planName || '-'}
					</Text>
					<Text style={styles.cardMeta} numberOfLines={2}>
						{continueMeta}
					</Text>
					<PrimaryButton
						label={tt('home.continue')}
						onPress={() => router.push(`/live/${active.planId ?? 'active'}`)}
					/>
				</Panel>
			) : next && heroMeta ? (
				<Panel style={styles.card}>
					<Pressable
						accessibilityRole="button"
						onPress={() => router.push(`/plan/${next.id}`)}
						style={({ pressed }) => pressed && styles.pressed}
					>
						<Text style={styles.eyebrow}>{tt('home.readyTitle')}</Text>
						<Text style={styles.cardTitle} numberOfLines={2}>
							{next.name || '-'}
						</Text>
						<Text style={styles.cardMeta} numberOfLines={2}>
							{heroMeta.exercises} {tt('common.exercises')} · {heroMeta.summary}
						</Text>
					</Pressable>
					<PrimaryButton
						label={tt('home.startWorkout')}
						onPress={() => router.push(`/plan/${next.id}`)}
					/>
				</Panel>
			) : null}

			{showChecklist && onboarding ? (
				<OnboardingChecklistPanel
					state={onboarding}
					onDismiss={() => void dismissChecklist().then(setOnboarding)}
				/>
			) : null}

			{showGuestHero ? (
				<Panel>
					<Text style={styles.eyebrow}>{tt('home.guestTrainKicker')}</Text>
					<Text style={styles.cardTitle}>{tt('home.guestTrainTitle')}</Text>
					<Text style={styles.cardMeta}>{tt('home.guestTrainLead')}</Text>
					<View style={styles.guestPoint}>
						<NotebookPen color={colors.muted} size={18} strokeWidth={2.25} />
						<Text style={styles.guestPointText}>{tt('home.guestPointLog')}</Text>
					</View>
					<View style={styles.guestPoint}>
						<Smartphone color={colors.muted} size={18} strokeWidth={2.25} />
						<Text style={styles.guestPointText}>{tt('home.guestPointLocal')}</Text>
					</View>
					<View style={styles.guestPoint}>
						<UserRound color={colors.muted} size={18} strokeWidth={2.25} />
						<Text style={styles.guestPointText}>{tt('home.guestPointSync')}</Text>
					</View>
					<PrimaryButton label={tt('home.guestCreateLocal')} onPress={() => void createBlank()} />
					<PrimaryButton
						label={tt('nav.signIn')}
						variant="secondary"
						onPress={() => router.push('/(tabs)/profile')}
					/>
				</Panel>
			) : null}

			{monthly && monthly.workouts > 0 ? (
				<View style={styles.section}>
					<View style={styles.sectionHead}>
						<Text style={styles.sectionTitle}>{tt('progress.sectionTitle')}</Text>
						<Pressable
							accessibilityRole="button"
							style={styles.sectionLink}
							onPress={() => router.push('/progress')}
						>
							<Text style={styles.sectionLinkText}>{tt('home.progressOpen')}</Text>
							<ChevronRight color={colors.muted} size={16} strokeWidth={2.25} />
						</Pressable>
					</View>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={tt('nav.progress')}
						style={({ pressed }) => [styles.monthlyRow, pressed && styles.pressed]}
						onPress={() => router.push('/progress')}
					>
						<Panel style={styles.monthlyCard}>
							<Text style={styles.monthlyValue}>{monthly.workouts}</Text>
							<Text style={styles.monthlyLabel}>{tt('progress.workouts30d')}</Text>
						</Panel>
						<Panel style={styles.monthlyCard}>
							<Text style={styles.monthlyValue}>{monthly.volumeKg}</Text>
							<Text style={styles.monthlyLabel}>{tt('progress.volume30d')}</Text>
						</Panel>
					</Pressable>
				</View>
			) : null}

			{recent.length > 0 ? (
				<View style={styles.section}>
					<View style={styles.sectionHead}>
						<Text style={styles.sectionTitle}>{tt('home.recentTitle')}</Text>
						<Pressable
							accessibilityRole="button"
							style={styles.sectionLink}
							onPress={() => router.push('/history')}
						>
							<Text style={styles.sectionLinkText}>{tt('home.recentAll')}</Text>
							<ChevronRight color={colors.muted} size={16} strokeWidth={2.25} />
						</Pressable>
					</View>
					{recent.map((session) => (
						<Pressable
							key={session.id}
							accessibilityRole="button"
							style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}
							onPress={() => router.push(`/history/${session.id}`)}
						>
							<View style={styles.recentBody}>
								<Text style={styles.recentTitle} numberOfLines={1}>
									{session.planName || '-'}
								</Text>
								<Text style={styles.recentMeta} numberOfLines={1}>
									{tt('home.recentMeta', {
										when: formatRelativeDay(
											session.finishedAt ?? session.startedAt,
											locale
										),
										min: sessionMinutes(session),
										sets: completedSetCount(session)
									})}
								</Text>
							</View>
							<ChevronRight color={colors.muted} size={16} strokeWidth={2.25} />
						</Pressable>
					))}
				</View>
			) : hasPlans ? (
				<Panel>
					<Text style={styles.sectionTitle}>{tt('home.firstWorkoutTitle')}</Text>
					<Text style={styles.cardMeta}>{tt('home.firstWorkoutHint')}</Text>
				</Panel>
			) : !showGuestHero ? (
				<Panel>
					<Text style={styles.sectionTitle}>{tt('home.recentPlaceholderTitle')}</Text>
					<Text style={styles.cardMeta}>{tt('home.recentPlaceholderHint')}</Text>
				</Panel>
			) : null}

		</View>
	);

	return (
		<ScrollView
			style={styles.flexList}
			contentContainerStyle={[styles.list, { paddingBottom: tabPad }]}
		>
			{header}
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	flexList: { flex: 1 },
	list: { flexGrow: 1, padding: space.lg, gap: space.sm },
	headerWrap: { gap: space.md, paddingBottom: space.sm },
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
		paddingBottom: space.xs
	},
	greeting: { ...type.title, color: colors.text, flex: 1 },
	leadHint: { ...type.meta, color: colors.muted },
	card: { gap: space.sm },
	eyebrow: {
		...type.section,
		color: colors.muted,
		textTransform: 'uppercase',
		letterSpacing: 0.8
	},
	cardTitle: { ...type.title, color: colors.text },
	cardMeta: { ...type.meta, color: colors.muted },
	guestPoint: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
		minHeight: touchMin
	},
	guestPointText: { ...type.meta, color: colors.muted, flex: 1 },
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
	section: { gap: space.sm },
	monthlyRow: { flexDirection: 'row', gap: space.sm },
	monthlyCard: { flex: 1, gap: 2, paddingVertical: space.md },
	monthlyValue: {
		fontSize: 24,
		lineHeight: 30,
		fontWeight: '800',
		fontFamily: fontFamily.extrabold,
		color: colors.text
	},
	monthlyLabel: { ...type.meta, color: colors.muted },
	sectionHead: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		minHeight: touchMin,
		marginTop: space.xs
	},
	sectionTitle: {
		...type.section,
		color: colors.muted,
		textTransform: 'uppercase',
		letterSpacing: 0.8
	},
	sectionLink: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 2,
		minHeight: touchMin,
		paddingHorizontal: space.sm
	},
	sectionLinkText: { ...type.meta, color: colors.muted, fontWeight: '700' },
	recentRow: {
		minHeight: touchMin,
		backgroundColor: colors.panel,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		paddingHorizontal: space.lg,
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm
	},
	recentBody: { flex: 1 },
	recentTitle: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: fontFamily.bold },
	recentMeta: { ...type.meta, color: colors.muted, marginTop: 2 },
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
	footerStack: { gap: space.sm },
	loadMore: {
		minHeight: touchMin,
		alignItems: 'center',
		justifyContent: 'center'
	},
	loadMoreDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: colors.panel
	},
	filterRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm
	},
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
	filterBtnActive: {
		borderColor: colors.accent,
		backgroundColor: colors.accentDim
	},
	clearFiltersRow: {
		minHeight: touchMin,
		justifyContent: 'center'
	},
	clearFiltersText: {
		color: colors.accentLink,
		fontWeight: '700',
		fontSize: 13,
		fontFamily: fontFamily.bold
	},
	syncBanner: {
		backgroundColor: colors.accentDim,
		borderColor: colors.accent
	},
	syncBannerText: {
		color: colors.accentText,
		fontWeight: '600',
		fontSize: 14,
		fontFamily: fontFamily.semibold
	}
	});
}