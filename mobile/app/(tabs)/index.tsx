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
	TextInput,
	View
} from 'react-native';
import { ChevronRight, Sparkles } from 'lucide-react-native';
import {
	dayGreetingPeriod,
	homeGreetingMessageKey
} from '@repdraft/domain/greeting';
import { greetingFirstName } from '@repdraft/domain/greetingName';
import {
	buildDemoPlan,
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
import type { QuestState } from '@repdraft/domain/quest';
import type { WorkoutPlan, WorkoutSession } from '@repdraft/domain/types';
import { loadExerciseIndex } from '../../src/catalog/loadIndex';
import { BrandMark } from '../../src/components/BrandMark';
import { QuestHomeBanner } from '../../src/components/QuestHomeBanner';
import { OnboardingChecklistPanel } from '../../src/components/OnboardingChecklistPanel';
import { Panel } from '../../src/components/Panel';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { getSupabase, isSupabaseConfigured } from '../../src/auth/supabase';
import { formatRelativeDay } from '@repdraft/i18n/format';
import { readHomeNextPlanId, writeHomeNextPlanId } from '../../src/live/homeNext';
import { readPlanOrder, writePlanOrder } from '../../src/live/planOrder';
import { loadGreetingName } from '../../src/state/greetingName';
import { useLocale } from '../../src/state/locale';
import { useTabScreenPad } from '../../src/layout/safe';
import { useAppColors } from '../../src/state/theme';
import { dismissChecklist, noteChecklist } from '../../src/state/onboarding';
import { isQuestEnabled, loadQuestState } from '../../src/state/quest';
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
	const tabPad = useTabScreenPad(space.lg);
	const [plans, setPlans] = useState<WorkoutPlan[]>([]);
	const [active, setActive] = useState<WorkoutSession | null>(null);
	const [recent, setRecent] = useState<WorkoutSession[]>([]);
	const [pinnedNextId, setPinnedNextId] = useState<string | null>(null);
	const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
	const [greetingCustom, setGreetingCustom] = useState('');
	const [authUser, setAuthUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [questOn, setQuestOn] = useState(false);
	const [questState, setQuestState] = useState<QuestState | null>(null);

	const reload = useCallback(async () => {
		setLoading(true);
		const [list, activeSession, sessions, order, pinned, qEnabled, qState] = await Promise.all([
			plansRepo.list(),
			readActiveSession(),
			sessionsRepo.list(),
			readPlanOrder(),
			readHomeNextPlanId(),
			isQuestEnabled(),
			loadQuestState()
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
		setQuestOn(qEnabled);
		setQuestState(qEnabled ? qState : null);
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
	const filteredPlans = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return plans;
		return plans.filter((p) => (p.name ?? '').toLowerCase().includes(q));
	}, [plans, searchQuery]);
	const searchActive = searchQuery.trim().length > 0;
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
			{questOn && questState ? <QuestHomeBanner state={questState} /> : null}

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
					<Text style={styles.cardMeta}>• {tt('home.guestPointLog')}</Text>
					<Text style={styles.cardMeta}>• {tt('home.guestPointLocal')}</Text>
					<Text style={styles.cardMeta}>• {tt('home.guestPointSync')}</Text>
					<PrimaryButton label={tt('home.guestCreateLocal')} onPress={() => void createBlank()} />
					<PrimaryButton
						label={tt('nav.signIn')}
						variant="secondary"
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
			{hasPlans ? (
				<TextInput
					value={searchQuery}
					onChangeText={setSearchQuery}
					placeholder={tt('workouts.searchPh')}
					placeholderTextColor={colors.muted}
					style={styles.search}
					autoCapitalize="none"
					autoCorrect={false}
					clearButtonMode="while-editing"
				/>
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
	);

	return (
		<View style={styles.root}>
			<FlatList
				style={styles.flexList}
				data={filteredPlans}
				keyExtractor={(item) => item.id}
				ListHeaderComponent={header}
				ListEmptyComponent={
					<Text style={styles.empty}>
						{searchActive ? tt('builder.noMatches') : tt('workouts.empty')}
					</Text>
				}
				contentContainerStyle={[styles.list, { paddingBottom: tabPad }]}
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
	pressed: { opacity: 0.85 },
	search: {
		minHeight: touchMin,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel,
		color: colors.text,
		paddingHorizontal: space.md,
		fontSize: 16
	},
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