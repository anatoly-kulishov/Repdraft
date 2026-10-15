import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	View
} from 'react-native';
import { ChevronRight, Play, Sparkles } from 'lucide-react-native';
import {
	dayGreetingPeriod,
	homeGreetingMessageKey
} from '@repdraft/domain/greeting';
import { greetingFirstName } from '@repdraft/domain/greetingName';
import {
	ONBOARDING_CHECKLIST_STEPS,
	buildDemoPlan,
	checklistProgress,
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
	duplicatePlan,
	planExerciseSlotCount,
	planTargetSummary,
	resolveHomeNextPlan,
	sortPlansByUserOrder
} from '@repdraft/domain/workout';
import type { WorkoutPlan, WorkoutSession } from '@repdraft/domain/types';
import { loadExerciseIndex } from '../../src/catalog/loadIndex';
import { BrandMark } from '../../src/components/BrandMark';
import { Panel } from '../../src/components/Panel';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { getSupabase, isSupabaseConfigured } from '../../src/auth/supabase';
import { formatRelativeDay } from '../../src/i18n/format';
import { readHomeNextPlanId, writeHomeNextPlanId } from '../../src/live/homeNext';
import { readPlanOrder, writePlanOrder } from '../../src/live/planOrder';
import { loadGreetingName } from '../../src/state/greetingName';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { dismissChecklist, noteChecklist } from '../../src/state/onboarding';
import { plansRepo } from '../../src/storage/plansRepo';
import { readActiveSession, sessionsRepo } from '../../src/storage/sessionsRepo';
import { deletePlanRemote, pushPlan } from '../../src/sync/cloudSync';
import { radius, space, touchMin, type, type ColorPalette } from '../../src/theme';

const RECENT_LIMIT = 3;

function sessionMinutes(session: WorkoutSession): number {
	return Math.max(1, Math.round((sessionDurationMs(session) ?? 60_000) / 60_000));
}

export default function WorkoutsScreen() {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const [plans, setPlans] = useState<WorkoutPlan[]>([]);
	const [active, setActive] = useState<WorkoutSession | null>(null);
	const [recent, setRecent] = useState<WorkoutSession[]>([]);
	const [pinnedNextId, setPinnedNextId] = useState<string | null>(null);
	const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
	const [greetingCustom, setGreetingCustom] = useState('');
	const [authUser, setAuthUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	const reload = useCallback(async () => {
		setLoading(true);
		const [list, activeSession, sessions, order, pinned] = await Promise.all([
			plansRepo.list(),
			readActiveSession(),
			sessionsRepo.list(),
			readPlanOrder(),
			readHomeNextPlanId()
		]);
		const nextOb = await noteChecklist('homeSeen');
		const lastFinished = sessions.find((s) => s.finishedAt && s.planId);
		const ordered = sortPlansByUserOrder(list, order);
		if (order.length === 0 && ordered.length > 0) {
			await writePlanOrder(ordered.map((p) => p.id));
		}
		setPlans(ordered);
		setActive(activeSession && !activeSession.finishedAt ? activeSession : null);
		setRecent(
			sessions
				.filter((s) => s.finishedAt)
				.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
				.slice(0, RECENT_LIMIT)
		);
		setPinnedNextId(pinned);
		setOnboarding(nextOb);
		const sb = getSupabase();
		const user = sb ? (await sb.auth.getSession()).data.session?.user ?? null : null;
		setAuthUser(user);
		setGreetingCustom(await loadGreetingName(user));
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

	const next = useMemo(
		() =>
			resolveHomeNextPlan(
				plans,
				recent[0]?.planId ?? null,
				pinnedNextId
			),
		[plans, recent, pinnedNextId]
	);
	const showChecklist = onboarding ? shouldShowChecklist(onboarding) : false;
	const progress = onboarding ? checklistProgress(onboarding) : null;
	const greetingName = greetingFirstName(greetingCustom, authUser);
	const greeting = tt(
		homeGreetingMessageKey(dayGreetingPeriod(), Boolean(greetingName)),
		greetingName ? { name: greetingName } : undefined
	);
	const isGuest = isSupabaseConfigured() && !authUser;
	const hasPlans = plans.length > 0;
	const hasRecent = recent.length > 0;
	const showGuestHero = isGuest && !hasPlans && !hasRecent && !active;

	const heroMeta = useMemo(() => {
		if (!next) return null;
		const indexById = new Map(loadExerciseIndex().map((item) => [item.id, item] as const));
		return {
			exercises: planExerciseSlotCount(next),
			summary: planTargetSummary(next, indexById, locale)
		};
	}, [next, locale]);

	const continueMeta = useMemo(() => {
		if (!active) return null;
		if (isSessionFullyLogged(active)) return tt('home.remainingFinishReady');
		return tt('home.remainingProgress', {
			exercises: Math.max(0, active.exercises.length - completedExerciseCount(active)),
			sets: Math.max(0, totalSetCount(active) - completedSetCount(active))
		});
	}, [active, tt]);

	if (loading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator color={colors.accent} />
			</View>
		);
	}

	const header = (
		<View style={styles.headerWrap}>
			<View style={styles.headerRow}>
				<BrandMark size={40} />
				<Text style={styles.greeting} numberOfLines={1}>
					{greeting}
				</Text>
			</View>
			<Text style={styles.leadHint}>{tt('workouts.lead')}</Text>

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
				<Pressable
					accessibilityRole="button"
					style={({ pressed }) => [styles.card, styles.heroCard, pressed && styles.pressed]}
					onPress={() => router.push(`/plan/${next.id}`)}
				>
					<Text style={styles.eyebrow}>{tt('home.readyTitle')}</Text>
					<Text style={styles.cardTitle} numberOfLines={2}>
						{next.name || '-'}
					</Text>
					<Text style={styles.cardMeta} numberOfLines={2}>
						{heroMeta.exercises} {tt('common.exercises')} · {heroMeta.summary}
					</Text>
					<View style={styles.heroCtaRow}>
						<View style={styles.heroCta}>
							<Play color={colors.accentText} size={18} strokeWidth={2.25} />
							<Text style={styles.heroCtaText}>{tt('home.startWorkout')}</Text>
						</View>
					</View>
				</Pressable>
			) : null}

			{showChecklist && onboarding && progress ? (
				<Panel style={styles.checklist}>
					<Text style={styles.checkTitle}>
						{tt('onboarding.title')} ({progress.done}/{progress.total})
					</Text>
					{ONBOARDING_CHECKLIST_STEPS.map((step) => (
						<Text
							key={step}
							style={[styles.checkItem, onboarding.checklist[step] && styles.checkDone]}
						>
							{onboarding.checklist[step] ? '✓ ' : '○ '}
							{tt(
								step === 'homeSeen'
									? 'onboarding.home'
									: step === 'planReady'
										? 'onboarding.plan'
										: step === 'liveEntered'
											? 'onboarding.live'
											: step === 'setLogged'
												? 'onboarding.set'
												: 'onboarding.finish'
							)}
						</Text>
					))}
					<PrimaryButton
						label={tt('onboarding.dismiss')}
						variant="ghost"
						onPress={() => void dismissChecklist().then(setOnboarding)}
					/>
				</Panel>
			) : null}

			{showGuestHero ? (
				<Panel>
					<Text style={styles.eyebrow}>{tt('home.guestTrainKicker')}</Text>
					<Text style={styles.cardTitle}>{tt('home.guestTrainTitle')}</Text>
					<Text style={styles.cardMeta}>{tt('home.guestTrainLead')}</Text>
					<Text style={styles.cardMeta}>• {tt('home.guestPointLog')}</Text>
					<Text style={styles.cardMeta}>• {tt('home.guestPointLocal')}</Text>
					<Text style={styles.cardMeta}>• {tt('home.guestPointSync')}</Text>
					<PrimaryButton label={tt('home.guestCreateLocal')} onPress={() => void createBlank()} />
					<PrimaryButton
						label={tt('nav.signIn')}
						variant="ghost"
						onPress={() => router.push('/(tabs)/profile')}
					/>
				</Panel>
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

			<View style={styles.sectionHead}>
				<Text style={styles.sectionTitle}>{tt('workouts.title')}</Text>
			</View>
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
	);

	return (
		<View style={styles.root}>
			<FlatList
				style={styles.flexList}
				data={plans}
				keyExtractor={(item) => item.id}
				ListHeaderComponent={header}
				ListEmptyComponent={<Text style={styles.empty}>{tt('workouts.empty')}</Text>}
				contentContainerStyle={styles.list}
				renderItem={({ item }) => (
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
												tt('home.setNextPlanDone', { name: item.name || tt('workouts.duplicate') })
											);
											return reload();
										});
									}
								},
								{
									text: tt('workouts.duplicate'),
									onPress: () => void duplicate(item)
								},
								{
									text: tt('workouts.delete'),
									style: 'destructive',
									onPress: () => {
										void (async () => {
											await plansRepo.remove(item.id);
											try {
												await deletePlanRemote(item.id);
											} catch {
												/* offline */
											}
											await reload();
										})();
									}
								}
							]);
						}}
					>
						<View style={styles.rowBody}>
							<Text style={styles.rowTitle} numberOfLines={2}>
								{item.name || '-'}
							</Text>
							<Text style={styles.rowMeta} numberOfLines={1}>
								{item.exercises.length} {tt('common.exercises')}
								{next?.id === item.id ? ` · ${tt('workouts.nextBadge')}` : ''}
							</Text>
						</View>
						<Text style={styles.dupHint}>{tt('workouts.longPress')}</Text>
					</Pressable>
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
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
	flexList: { flex: 1 },
	list: { flexGrow: 1, padding: space.lg, paddingBottom: space.xxl, gap: space.sm },
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
	heroCard: {
		backgroundColor: colors.panel,
		borderRadius: radius.lg,
		borderWidth: 1,
		borderColor: colors.border,
		padding: space.lg
	},
	heroCtaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: space.xs },
	heroCta: {
		minHeight: touchMin,
		backgroundColor: colors.accent,
		borderRadius: radius.md,
		paddingHorizontal: 18,
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm
	},
	heroCtaText: { color: colors.accentText, fontSize: 16, fontWeight: '700' },
	pressed: { opacity: 0.85 },
	checklist: { gap: 6, padding: space.md },
	checkTitle: { color: colors.text, fontWeight: '800', marginBottom: 4 },
	checkItem: { color: colors.muted, fontSize: 14 },
	checkDone: { color: colors.accent },
	section: { gap: space.sm },
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
	recentTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
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
	rowTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
	rowMeta: { color: colors.muted, marginTop: 4, fontSize: 13 },
	rowNext: { borderColor: colors.accent, backgroundColor: colors.accentDim },
	dupHint: { color: colors.muted, fontSize: 11, fontWeight: '600', maxWidth: 72, textAlign: 'right' },
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
	aiRowText: { ...type.body, color: colors.text, flex: 1 }
	});
}