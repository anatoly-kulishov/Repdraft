import {
	buildDemoPlan,
	checklistProgress,
	defaultOnboardingState,
	isOnboardingActivated,
	markChecklistStep,
	parseOnboardingState,
	shouldDeferPwaHint,
	shouldRevealLiveFillAll,
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

if (shouldRevealLiveFillAll(fresh)) {
	throw new Error('fresh day-1 should hide fill-all');
}

const afterSet = markChecklistStep(fresh, 'setLogged');
if (!shouldRevealLiveFillAll(afterSet)) {
	throw new Error('after setLogged: fill-all on');
}
if (!shouldShowChecklist(afterSet)) {
	throw new Error('setLogged alone should still show checklist');
}

const dismissed = { ...afterSet, checklistDismissed: true };
if (shouldShowChecklist(dismissed)) {
	throw new Error('dismissed checklist should hide checklist');
}
if (!shouldRevealLiveFillAll(dismissed)) {
	throw new Error('dismiss must unlock fill-all (no permanent hide)');
}

if (!shouldRevealLiveFillAll(activated)) {
	throw new Error('activated should reveal fill-all');
}
if (shouldShowChecklist(activated)) {
	throw new Error('activated should hide checklist');
}

console.log('onboarding.selfcheck: ok');
