import { browser } from '$app/environment';
import {
	buildDemoPlan,
	defaultOnboardingState,
	dismissCoachmarkState,
	isCanonicalDemoPlan,
	isOnboardingActivated,
	markChecklistStep,
	ONBOARDING_STORAGE_KEY,
	parseOnboardingState,
	shouldDeferPwaHint,
	shouldShowChecklist,
	shouldShowCoachmark,
	DEMO_PLAN_ID,
	type CoachmarkId,
	type OnboardingChecklistStep,
	type OnboardingState
} from '$lib/domain/onboarding';
import { translate } from '$lib/i18n/messages';
import { get, writable } from 'svelte/store';
import { plans } from './plans';
import { resolvedLocale } from './locale';

function readState(): OnboardingState {
	if (!browser) return defaultOnboardingState();
	try {
		const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
		if (!raw) return defaultOnboardingState();
		return parseOnboardingState(JSON.parse(raw) as unknown);
	} catch {
		return defaultOnboardingState();
	}
}

function writeState(state: OnboardingState) {
	if (!browser) return;
	try {
		localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
	} catch {
		/* ignore */
	}
}

function createOnboardingStore() {
	const store = writable<OnboardingState>(defaultOnboardingState());
	let visitRecorded = false;

	function patch(mutator: (state: OnboardingState) => OnboardingState) {
		store.update((state) => {
			const next = mutator(state);
			writeState(next);
			return next;
		});
	}

	return {
		subscribe: store.subscribe,
		init(search: URLSearchParams) {
			if (!browser) return;
			if (search.get('onboarding') === 'reset') {
				try {
					localStorage.removeItem(ONBOARDING_STORAGE_KEY);
				} catch {
					/* ignore */
				}
				store.set(defaultOnboardingState());
				visitRecorded = false;
			} else {
				store.set(readState());
			}
			if (!visitRecorded) {
				visitRecorded = true;
				patch((s) => ({ ...s, visitCount: s.visitCount + 1 }));
			}
		},
		markChecklist(step: OnboardingChecklistStep) {
			patch((s) => markChecklistStep(s, step));
		},
		dismissChecklist() {
			patch((s) => ({ ...s, checklistDismissed: true }));
		},
		dismissCoachmark(id: CoachmarkId) {
			patch((s) => dismissCoachmarkState(s, id));
		},
		setDemoPlanInstalled() {
			patch((s) => ({ ...s, demoPlanInstalled: true }));
		},
		showChecklist(): boolean {
			return shouldShowChecklist(get(store));
		},
		showCoachmark(id: CoachmarkId): boolean {
			return shouldShowCoachmark(get(store), id);
		},
		deferPwaHint(): boolean {
			return shouldDeferPwaHint(get(store));
		},
		activated(): boolean {
			return isOnboardingActivated(get(store));
		},
		async installDemoPlan(): Promise<string> {
			const lang = get(resolvedLocale);
			const plan = buildDemoPlan(translate(lang, 'onboarding.demoPlanName'));
			const existing = get(plans).find((p) => p.id === DEMO_PLAN_ID);
			if (existing && isCanonicalDemoPlan(existing)) {
				this.markChecklist('planReady');
				this.setDemoPlanInstalled();
				return existing.id;
			}
			const index = existing ? get(plans).findIndex((p) => p.id === DEMO_PLAN_ID) : 0;
			await plans.restorePlan(plan, Math.max(0, index));
			this.markChecklist('planReady');
			this.setDemoPlanInstalled();
			return plan.id;
		},
		resetForDev() {
			if (!browser) return;
			try {
				localStorage.removeItem(ONBOARDING_STORAGE_KEY);
			} catch {
				/* ignore */
			}
			store.set(defaultOnboardingState());
			visitRecorded = false;
		}
	};
}

export const onboarding = createOnboardingStore();
