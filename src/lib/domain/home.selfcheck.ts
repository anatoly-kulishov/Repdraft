import { resolveHomeSkeletonVariant } from './home.ts';

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
		label: 'stale create cookie while auth bootstraps',
		input: { accountBoot: false, homeBoot: 'create' },
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

console.log('home.selfcheck: ok');
