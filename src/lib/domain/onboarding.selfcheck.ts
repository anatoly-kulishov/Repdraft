import {
	buildDemoPlan,
	checklistProgress,
	defaultOnboardingState,
	isOnboardingActivated,
	markChecklistStep,
	parseOnboardingState,
	shouldDeferPwaHint,
	shouldShowChecklist,
	shouldShowCoachmark,
	DEMO_PLAN_ID
} from './onboarding.ts';

const fresh = defaultOnboardingState();
if (!shouldShowChecklist(fresh)) {
	throw new Error('fresh state should show checklist');
}
if (shouldDeferPwaHint(fresh)) {
	/* ok */
} else {
	throw new Error('fresh state should defer PWA');
}

let stepped = markChecklistStep(fresh, 'homeSeen');
stepped = markChecklistStep(stepped, 'planReady');
if (checklistProgress(stepped).done !== 2) {
	throw new Error('checklistProgress should count completed steps');
}

const activated = markChecklistStep(stepped, 'sessionFinished');
if (!isOnboardingActivated(activated)) {
	throw new Error('sessionFinished should activate onboarding');
}
if (shouldShowChecklist(activated)) {
	throw new Error('activated should hide checklist');
}

const parsed = parseOnboardingState({
	checklist: { homeSeen: true },
	coachmarks: { 'live.logging': true },
	visitCount: 3
});
if (!parsed.checklist.homeSeen || parsed.checklist.planReady) {
	throw new Error('parseOnboardingState checklist merge failed');
}
if (shouldShowCoachmark(parsed, 'live.logging')) {
	throw new Error('dismissed coachmark should not show');
}
if (shouldShowCoachmark(parsed, 'preview.start') !== true) {
	throw new Error('undismissed coachmark should show');
}

const demo = buildDemoPlan('Demo');
if (demo.id !== DEMO_PLAN_ID || demo.exercises.length !== 3) {
	throw new Error('buildDemoPlan shape invalid');
}

console.log('onboarding.selfcheck: ok');
