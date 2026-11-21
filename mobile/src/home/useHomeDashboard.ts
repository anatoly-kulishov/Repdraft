import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import { dayGreetingPeriod, homeGreetingMessageKey } from '@repdraft/domain/greeting';
import { greetingFirstName } from '@repdraft/domain/greetingName';
import {
	buildDemoPlan,
	DEMO_PLAN_ID,
	isCanonicalDemoPlan,
	ONBOARDING_STORAGE_KEY,
	shouldShowChecklist,
	type OnboardingState
} from '@repdraft/domain/onboarding';
import {
	completedExerciseCount,
	completedSetCount,
	isSessionFullyLogged,
	totalSetCount
} from '@repdraft/domain/session';
import {
	createEmptyDraft,
	planEstimatedMinutes,
	planExerciseSlotCount,
	planTargetSummary,
	resolveHomeNextPlan,
	sortPlansByUserOrder
} from '@repdraft/domain/workout';
import {
	computeProgressOverview,
	type ProgressOverview,
	type ProgressPeriod
} from '@repdraft/domain/progressOverview';
import { cycleProgressNow, type Mesocycle } from '@repdraft/domain/cycle';
import type { WorkoutPlan, WorkoutSession } from '@repdraft/domain/types';
import { resolveUserAvatarUrl } from '../auth/avatarUrl';
import { getSupabase, isSupabaseConfigured } from '../auth/supabase';
import { loadExerciseIndex } from '../catalog/loadIndex';
import { readHomeNextPlanId } from '../live/homeNext';
import { readCycle } from '../state/cycle';
import { readProgressPeriod } from '../state/progressPeriod';
import { readPlanOrder, writePlanOrder } from '../live/planOrder';
import { loadGreetingName } from '../state/greetingName';
import { useLocale } from '../state/locale';
import { dismissChecklist, noteChecklist } from '../state/onboarding';
import { kvGet, kvRemove, kvSet, kvSetJson } from '../storage/kv';
import { plansRepo } from '../storage/plansRepo';
import { readActiveSession, sessionsRepo } from '../storage/sessionsRepo';
import { outboxCount } from '../sync/cloudSync';
import { coachRepo } from '../storage/coachRepo';
import {
	COACH_ASSIGNMENT_HIDDEN_KEY,
	isAssignmentHiddenOnHome,
	type CoachAssignment
} from '@repdraft/domain/coach';
import { importAssignedPlan } from '../coach/importAssignment';

const RECENT_LIMIT = 3;

/**
 * Home dashboard data: plans, active session, recent history, 30-day cards,
 * greeting/avatar and onboarding checklist. UI lives in `src/home/*`.
 */
export function useHomeDashboard() {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const [plans, setPlans] = useState<WorkoutPlan[]>([]);
	const [active, setActive] = useState<WorkoutSession | null>(null);
	const [recent, setRecent] = useState<WorkoutSession[]>([]);
	const [monthly, setMonthly] = useState<ProgressOverview | null>(null);
	const [period, setPeriod] = useState<ProgressPeriod>(30);
	const [pinnedNextId, setPinnedNextId] = useState<string | null>(null);
	const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
	const [greetingCustom, setGreetingCustom] = useState('');
	const [authUser, setAuthUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [pendingSync, setPendingSync] = useState(0);
	const [assignment, setAssignment] = useState<CoachAssignment | null>(null);
	const [assignmentBusy, setAssignmentBusy] = useState(false);
	const [cycle, setCycleState] = useState<Mesocycle | null>(null);

	const reload = useCallback(async () => {
		setLoading(true);
		const [list, activeSession, sessions, order, pinned, outbox, storedCycle, storedPeriod] =
			await Promise.all([
				plansRepo.list(),
				readActiveSession(),
				sessionsRepo.list(),
				readPlanOrder(),
				readHomeNextPlanId(),
				outboxCount(),
				readCycle(),
				readProgressPeriod()
			]);
		const nextOnboarding = await noteChecklist('homeSeen');
		const ordered = sortPlansByUserOrder(list, order);
		const nextOrder = order.length > 0 ? order : ordered.map((plan) => plan.id);
		if (order.length === 0 && ordered.length > 0) {
			await writePlanOrder(nextOrder);
		}
		setPlans(ordered);
		setActive(activeSession && !activeSession.finishedAt ? activeSession : null);
		setRecent(
			sessions
				.filter((session) => session.finishedAt)
				.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
				.slice(0, RECENT_LIMIT)
		);
		setPeriod(storedPeriod);
		setMonthly(computeProgressOverview(sessions, new Date(), undefined, { period: storedPeriod }));
		setPinnedNextId(pinned);
		setCycleState(storedCycle);
		setOnboarding(nextOnboarding);
		const supabase = getSupabase();
		const user = supabase ? (await supabase.auth.getSession()).data.session?.user ?? null : null;
		setAuthUser(user);
		if (user) {
			const [current, hiddenId] = await Promise.all([
				coachRepo.myCurrentAssignment(),
				kvGet(COACH_ASSIGNMENT_HIDDEN_KEY)
			]);
			const next = current.ok ? current.value : null;
			setAssignment(isAssignmentHiddenOnHome(next, hiddenId) ? null : next);
		} else {
			setAssignment(null);
		}
		setGreetingCustom(await loadGreetingName(user));
		setPendingSync(outbox);
		setLoading(false);
	}, []);

	useFocusEffect(
		useCallback(() => {
			void reload();
		}, [reload])
	);

	const createBlank = useCallback(async () => {
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
	}, [router, tt]);

	const tryDemo = useCallback(async () => {
		try {
			const existing = await plansRepo.get(DEMO_PLAN_ID);
			if (existing && isCanonicalDemoPlan(existing)) {
				const nextState = {
					...(await noteChecklist('planReady')),
					demoPlanInstalled: true
				};
				await kvSetJson(ONBOARDING_STORAGE_KEY, nextState);
				setOnboarding(nextState);
				router.push(`/plan/${existing.id}`);
				return;
			}
			const plan = buildDemoPlan(tt('onboarding.demoPlanName'));
			await plansRepo.save(plan);
			const nextState = {
				...(await noteChecklist('planReady')),
				demoPlanInstalled: true
			};
			await kvSetJson(ONBOARDING_STORAGE_KEY, nextState);
			setOnboarding(nextState);
			await reload();
			router.push(`/plan/${plan.id}`);
		} catch {
			Alert.alert(tt('common.error'), tt('onboarding.demoFail'));
		}
	}, [reload, router, tt]);

	const dismissOnboarding = useCallback(async () => {
		setOnboarding(await dismissChecklist());
	}, []);

	const importAssignment = useCallback(async () => {
		const current = assignment;
		if (!current || assignmentBusy) return;
		setAssignmentBusy(true);
		try {
			await importAssignedPlan(current);
			await coachRepo.discardAssignment();
			await kvRemove(COACH_ASSIGNMENT_HIDDEN_KEY);
			setAssignment(null);
			await reload();
			Alert.alert(tt('coach.assignedAdded'));
		} catch {
			Alert.alert(tt('common.error'), tt('coach.error.unknown'));
		} finally {
			setAssignmentBusy(false);
		}
	}, [assignment, assignmentBusy, reload, tt]);

	const hideAssignment = useCallback(async () => {
		const id = assignment?.assignmentId;
		if (id) await kvSet(COACH_ASSIGNMENT_HIDDEN_KEY, id);
		setAssignment(null);
	}, [assignment]);

	const next = useMemo(
		() => resolveHomeNextPlan(plans, recent[0]?.planId ?? null, pinnedNextId),
		[plans, recent, pinnedNextId]
	);
	const indexById = useMemo(
		() => new Map(loadExerciseIndex().map((item) => [item.id, item] as const)),
		[]
	);
	const heroMeta = useMemo(() => {
		if (!next) return null;
		return {
			exercises: planExerciseSlotCount(next),
			minutes: planEstimatedMinutes(next),
			summary: planTargetSummary(next, indexById, locale, 3)
		};
	}, [next, indexById, locale]);

	const cycleBadge = useMemo(() => {
		if (!cycle || !next || !cycle.planIds.includes(next.id)) return null;
		const current = cycleProgressNow(cycle);
		return tt('cycle.cardWeek', { week: current.week, total: cycle.weeks });
	}, [cycle, next, tt]);

	const greetingName = greetingFirstName(greetingCustom, authUser);
	const greeting = tt(
		homeGreetingMessageKey(dayGreetingPeriod(), Boolean(greetingName)),
		greetingName ? { name: greetingName } : undefined
	);

	const continueMeta = useMemo(() => {
		if (!active) return null;
		if (isSessionFullyLogged(active)) return tt('home.remainingFinishReady');
		return tt('home.remainingProgress', {
			exercises: Math.max(0, active.exercises.length - completedExerciseCount(active)),
			sets: Math.max(0, totalSetCount(active) - completedSetCount(active))
		});
	}, [active, tt]);

	const hasPlans = plans.length > 0;
	const hasRecent = recent.length > 0;
	const isGuest = isSupabaseConfigured() && !authUser;

	return {
		loading,
		plans,
		active,
		recent,
		monthly,
		period,
		onboarding,
		pendingSync,
		next,
		heroMeta,
		cycleBadge,
		greeting,
		avatarUrl: authUser ? resolveUserAvatarUrl(authUser) : null,
		hasPlans,
		isGuest,
		showGuestHero: isGuest && !hasPlans && !hasRecent && !active,
		/* Same gate as web: the checklist is for the cold start, not a permanent banner. */
		showChecklist: onboarding ? shouldShowChecklist(onboarding) && plans.length === 0 : false,
		continueMeta,
		createBlank,
		dismissOnboarding,
		tryDemo,
		assignment,
		assignmentBusy,
		importAssignment,
		hideAssignment
	};
}

export type HomeDashboardState = ReturnType<typeof useHomeDashboard>;
