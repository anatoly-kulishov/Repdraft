import { resolveHomeSkeletonVariant, shouldShowHomeChecklistSkeleton } from './home.ts';

const cases: Array<{
	label: string;
	input: Parameters<typeof resolveHomeSkeletonVariant>[0];
	want: 'create' | 'start';
}> = [
	{
		label: 'account boot overrides stale guest home cookie',
		input: { accountBoot: true, homeBoot: 'create' },
		want: 'start'
	},
	{
		label: 'guest create peek while auth bootstraps',
		input: { accountBoot: false, homeBoot: 'create' },
		want: 'create'
	},
	{
		label: 'signed-in peek overrides stale create cookie',
		input: { accountBoot: false, homeBoot: 'create', likelySignedIn: true },
		want: 'start'
	},
	{
		label: 'guest without plans (auth ready)',
		input: {
			accountBoot: false,
			homeBoot: 'create',
			authReady: true,
			hasUser: false,
			hasPlans: false
		},
		want: 'create'
	},
	{
		label: 'guest with plans',
		input: { accountBoot: false, homeBoot: 'start' },
		want: 'start'
	},
	{
		label: 'plans peek beats stale create cookie',
		input: { accountBoot: false, homeBoot: 'create', hasPlans: true },
		want: 'start'
	},
	{
		label: 'auth ready signed-in',
		input: { accountBoot: false, authReady: true, hasUser: true },
		want: 'start'
	}
];

for (const { label, input, want } of cases) {
	const got = resolveHomeSkeletonVariant(input);
	if (got !== want) {
		throw new Error(`resolveHomeSkeletonVariant: ${label} → ${got}, want ${want}`);
	}
}

const checklistCases: Array<{
	label: string;
	input: Parameters<typeof shouldShowHomeChecklistSkeleton>[0];
	want: boolean;
}> = [
	{
		label: 'guest with plans hides checklist',
		input: { onboardingShowsChecklist: true, hasPlans: true, homeBoot: 'start' },
		want: false
	},
	{
		label: 'signed-in empty still shows checklist',
		input: { onboardingShowsChecklist: true, hasPlans: false, homeBoot: 'start' },
		want: true
	},
	{
		label: 'guest empty home keeps checklist',
		input: { onboardingShowsChecklist: true, homeBoot: 'create' },
		want: true
	},
	{
		label: 'onboarding dismissed hides checklist',
		input: { onboardingShowsChecklist: false, homeBoot: 'create' },
		want: false
	}
];

for (const { label, input, want } of checklistCases) {
	const got = shouldShowHomeChecklistSkeleton(input);
	if (got !== want) {
		throw new Error(`shouldShowHomeChecklistSkeleton: ${label} → ${got}, want ${want}`);
	}
}

console.log('home.selfcheck: ok');
