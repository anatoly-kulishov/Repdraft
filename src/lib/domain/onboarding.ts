import { addExercise, createEmptyDraft } from '$lib/domain/workout';
import type { WorkoutPlan } from '$lib/domain/types';

export const ONBOARDING_STORAGE_KEY = 'repdraft:onboarding';
export const DEMO_PLAN_ID = 'repdraft-onboarding-demo';

export type OnboardingChecklistStep =
	| 'homeSeen'
	| 'planReady'
	| 'liveEntered'
	| 'setLogged'
	| 'sessionFinished';

export const ONBOARDING_CHECKLIST_STEPS: readonly OnboardingChecklistStep[] = [
	'homeSeen',
	'planReady',
	'liveEntered',
	'setLogged',
	'sessionFinished'
];

export type CoachmarkId =
	| 'preview.start'
	| 'live.logging'
	| 'live.finish'
	| 'builder.intro'
	| 'builder.superset'
	| 'workouts.preview'
	| 'exercises.search'
	| 'exercises.picker'
	| 'exercise.tabs'
	| 'records.empty'
	| 'history.detail'
	| 'draft.dock';

export const COACHMARK_IDS: readonly CoachmarkId[] = [
	'preview.start',
	'live.logging',
	'live.finish',
	'builder.intro',
	'builder.superset',
	'workouts.preview',
	'exercises.search',
	'exercises.picker',
	'exercise.tabs',
	'records.empty',
	'history.detail',
	'draft.dock'
];

export type OnboardingState = {
	checklistDismissed: boolean;
	checklist: Record<OnboardingChecklistStep, boolean>;
	coachmarks: Partial<Record<CoachmarkId, true>>;
	activatedAt: string | null;
	demoPlanInstalled: boolean;
	visitCount: number;
};

export function defaultChecklist(): Record<OnboardingChecklistStep, boolean> {
	return {
		homeSeen: false,
		planReady: false,
		liveEntered: false,
		setLogged: false,
		sessionFinished: false
	};
}

export function defaultOnboardingState(): OnboardingState {
	return {
		checklistDismissed: false,
		checklist: defaultChecklist(),
		coachmarks: {},
		activatedAt: null,
		demoPlanInstalled: false,
		visitCount: 0
	};
}

function isChecklistStep(value: string): value is OnboardingChecklistStep {
	return (ONBOARDING_CHECKLIST_STEPS as readonly string[]).includes(value);
}

function isCoachmarkId(value: string): value is CoachmarkId {
	return (COACHMARK_IDS as readonly string[]).includes(value);
}

export function parseOnboardingState(raw: unknown): OnboardingState {
	const base = defaultOnboardingState();
	if (!raw || typeof raw !== 'object') return base;
	const o = raw as Record<string, unknown>;
	const checklist = defaultChecklist();
	if (o.checklist && typeof o.checklist === 'object') {
		const c = o.checklist as Record<string, unknown>;
		for (const step of ONBOARDING_CHECKLIST_STEPS) {
			if (c[step] === true) checklist[step] = true;
		}
	}
	const coachmarks: Partial<Record<CoachmarkId, true>> = {};
	if (o.coachmarks && typeof o.coachmarks === 'object') {
		for (const [key, value] of Object.entries(o.coachmarks as Record<string, unknown>)) {
			if (value === true && isCoachmarkId(key)) coachmarks[key] = true;
		}
	}
	return {
		checklistDismissed: o.checklistDismissed === true,
		checklist,
		coachmarks,
		activatedAt: typeof o.activatedAt === 'string' ? o.activatedAt : null,
		demoPlanInstalled: o.demoPlanInstalled === true,
		visitCount:
			typeof o.visitCount === 'number' && Number.isFinite(o.visitCount)
				? Math.max(0, Math.floor(o.visitCount))
				: 0
	};
}

export function isOnboardingActivated(state: OnboardingState): boolean {
	return state.activatedAt != null || state.checklist.sessionFinished;
}

export function checklistProgress(state: OnboardingState): { done: number; total: number } {
	const total = ONBOARDING_CHECKLIST_STEPS.length;
	const done = ONBOARDING_CHECKLIST_STEPS.filter((step) => state.checklist[step]).length;
	return { done, total };
}

export function shouldShowChecklist(state: OnboardingState): boolean {
	if (state.checklistDismissed || isOnboardingActivated(state)) return false;
	return true;
}

/** Sync peek for home boot skeleton before Svelte hydrates onboarding store. */
export function peekShouldShowChecklist(): boolean {
	if (typeof localStorage === 'undefined') return false;
	try {
		const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
		if (!raw) return true;
		return shouldShowChecklist(parseOnboardingState(JSON.parse(raw) as unknown));
	} catch {
		return true;
	}
}

/** Sync peek for builder superset banner skeleton before onboarding store hydrates. */
export function peekShouldShowCoachmark(id: CoachmarkId): boolean {
	if (typeof localStorage === 'undefined') return false;
	try {
		const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
		if (!raw) return shouldShowCoachmark(defaultOnboardingState(), id);
		return shouldShowCoachmark(parseOnboardingState(JSON.parse(raw) as unknown), id);
	} catch {
		return false;
	}
}

/** Keep SSR cookie in sync so `/` checklist skeleton matches first paint. */
export function syncOnboardingChecklistBootCookie(state?: OnboardingState): void {
	if (typeof document === 'undefined') return;
	try {
		const show = state ? shouldShowChecklist(state) : peekShouldShowChecklist();
		document.documentElement.dataset.homeShowChecklist = show ? '1' : '0';
		if (show) {
			document.cookie =
				'repdraft_onboarding_checklist=1; path=/; Max-Age=31536000; SameSite=Lax';
		} else {
			document.cookie = 'repdraft_onboarding_checklist=; path=/; Max-Age=0; SameSite=Lax';
		}
	} catch {
		/* ignore */
	}
}

export function shouldShowCoachmark(state: OnboardingState, id: CoachmarkId): boolean {
	if (isOnboardingActivated(state)) return false;
	return state.coachmarks[id] !== true;
}

export function shouldDeferPwaHint(state: OnboardingState): boolean {
	if (isOnboardingActivated(state)) return false;
	return state.visitCount < 2;
}

const DEMO_EXERCISE_IDS = ['0025', '0043', '1350'] as const;

export function isCanonicalDemoPlan(plan: WorkoutPlan): boolean {
	if (plan.id !== DEMO_PLAN_ID || plan.exercises.length !== DEMO_EXERCISE_IDS.length) {
		return false;
	}
	return plan.exercises.every(
		(ex, index) => ex.exerciseId === DEMO_EXERCISE_IDS[index]
	);
}

/** Fixed-id demo plan for fast activation path. */
export function buildDemoPlan(planName: string, nowIso = new Date().toISOString()): WorkoutPlan {
	let plan: WorkoutPlan = {
		id: DEMO_PLAN_ID,
		name: planName,
		createdAt: nowIso,
		updatedAt: nowIso,
		exercises: []
	};
	for (const exerciseId of DEMO_EXERCISE_IDS) {
		plan = addExercise(plan, exerciseId).plan;
	}
	return plan;
}

export function markChecklistStep(
	state: OnboardingState,
	step: OnboardingChecklistStep
): OnboardingState {
	if (state.checklist[step]) return state;
	const checklist = { ...state.checklist, [step]: true };
	const activatedAt =
		step === 'sessionFinished' && !state.activatedAt ? new Date().toISOString() : state.activatedAt;
	return { ...state, checklist, activatedAt };
}

export function dismissCoachmarkState(
	state: OnboardingState,
	id: CoachmarkId
): OnboardingState {
	if (state.coachmarks[id]) return state;
	return { ...state, coachmarks: { ...state.coachmarks, [id]: true } };
}
