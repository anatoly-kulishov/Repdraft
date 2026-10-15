import {
	ONBOARDING_STORAGE_KEY,
	defaultOnboardingState,
	dismissCoachmarkState,
	markChecklistStep,
	parseOnboardingState,
	shouldShowChecklist,
	shouldShowCoachmark,
	type CoachmarkId,
	type OnboardingChecklistStep,
	type OnboardingState
} from '@repdraft/domain/onboarding';
import { kvGetJson, kvSetJson } from '../storage/kv';

async function read(): Promise<OnboardingState> {
	const raw = await kvGetJson<unknown>(ONBOARDING_STORAGE_KEY, null);
	return parseOnboardingState(raw);
}

async function write(state: OnboardingState): Promise<void> {
	await kvSetJson(ONBOARDING_STORAGE_KEY, state);
}

export async function loadOnboarding(): Promise<OnboardingState> {
	return read();
}

export async function noteChecklist(step: OnboardingChecklistStep): Promise<OnboardingState> {
	const next = markChecklistStep(await read(), step);
	await write(next);
	return next;
}

export async function dismissChecklist(): Promise<OnboardingState> {
	const next = { ...(await read()), checklistDismissed: true };
	await write(next);
	return next;
}

export async function dismissCoachmark(id: CoachmarkId): Promise<OnboardingState> {
	const next = dismissCoachmarkState(await read(), id);
	await write(next);
	return next;
}

export async function checklistVisible(): Promise<boolean> {
	return shouldShowChecklist(await read());
}

export async function coachmarkVisible(id: CoachmarkId): Promise<boolean> {
	return shouldShowCoachmark(await read(), id);
}

export { defaultOnboardingState, shouldShowChecklist };
