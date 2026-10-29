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
import { progress30d } from '@repdraft/domain/progressOverview';
import type { WorkoutPlan, WorkoutSession } from '@repdraft/domain/types';
import { resolveUserAvatarUrl } from '../auth/avatarUrl';
import { getSupabase, isSupabaseConfigured } from '../auth/supabase';
import { loadExerciseIndex } from '../catalog/loadIndex';
import { readHomeNextPlanId } from '../live/homeNext';
import { readPlanOrder, writePlanOrder } from '../live/planOrder';
import { loadGreetingName } from '../state/greetingName';
import { useLocale } from '../state/locale';
import { dismissChecklist, noteChecklist } from '../state/onboarding';
import { kvSetJson } from '../storage/kv';
import { plansRepo } from '../storage/plansRepo';
import { readActiveSession, sessionsRepo } from '../storage/sessionsRepo';
import { outboxCount } from '../sync/cloudSync';

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
	const [monthly, setMonthly] = useState<ReturnType<typeof progress30d> | null>(null);
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
		setMonthly(progress30d(sessions, new Date()));
		setPinnedNextId(pinned);
		setOnboarding(nextOnboarding);
		const supabase = getSupabase();
		const user = supabase ? (await supabase.auth.getSession()).data.session?.user ?? null : null;
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
		onboarding,
		pendingSync,
		next,
		heroMeta,
		greeting,
		avatarUrl: authUser ? resolveUserAvatarUrl(authUser) : null,
		hasPlans,
		isGuest,
		showGuestHero: isGuest && !hasPlans && !hasRecent && !active,
		showChecklist: onboarding ? shouldShowChecklist(onboarding) : false,
		continueMeta,
		createBlank,
		dismissOnboarding,
		tryDemo
	};
}

export type HomeDashboardState = ReturnType<typeof useHomeDashboard>;
