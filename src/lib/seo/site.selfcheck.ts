import {
	absoluteUrl,
	formatSeoTitle,
	isUsableSiteOrigin,
	resolveSiteOrigin,
	SITE_NAME
} from '$lib/seo/site';

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

assert(isUsableSiteOrigin('https://www.repdraft.xyz'), 'https prod origin ok');
assert(isUsableSiteOrigin('http://127.0.0.1:5173'), 'local e2e origin ok');
assert(!isUsableSiteOrigin(''), 'empty rejected');
assert(!isUsableSiteOrigin('http://sveltekit-prerender'), 'prerender placeholder rejected');
assert(!isUsableSiteOrigin('http://sveltekit-prerender/'), 'prerender placeholder slash rejected');
assert(!isUsableSiteOrigin('not-a-url'), 'junk rejected');

assert(
	resolveSiteOrigin('http://sveltekit-prerender') === '',
	'resolve drops prerender placeholder when env unset (non-production)'
);
assert(
	resolveSiteOrigin('https://www.repdraft.xyz/') === 'https://www.repdraft.xyz',
	'resolve keeps real request origin'
);
assert(
	absoluteUrl('/articles', 'http://sveltekit-prerender') === '/articles',
	'absoluteUrl stays relative when origin unusable outside production'
);
assert(
	absoluteUrl('/articles', 'https://www.repdraft.xyz') === 'https://www.repdraft.xyz/articles',
	'absoluteUrl joins usable origin'
);

assert(formatSeoTitle(SITE_NAME) === SITE_NAME, 'bare brand title');
assert(formatSeoTitle('Упражнения') === `Упражнения · ${SITE_NAME}`, 'page title gets brand suffix');
assert(
	formatSeoTitle('Repdraft - дневник тренировок в зале') === 'Repdraft - дневник тренировок в зале',
	'title that already starts with brand is not doubled'
);

{
	const prev = process.env.VERCEL_ENV;
	process.env.VERCEL_ENV = 'production';
	assert(
		resolveSiteOrigin('http://sveltekit-prerender') === 'https://www.repdraft.xyz',
		'production prerender falls back to canonical host'
	);
	if (prev === undefined) delete process.env.VERCEL_ENV;
	else process.env.VERCEL_ENV = prev;
}

console.log('site.selfcheck: ok');
