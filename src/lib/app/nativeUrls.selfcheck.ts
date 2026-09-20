import {
	isAuthDeepLinkUrl,
	resolveWebApiOrigin,
	webAnalyticsAvailable
} from './nativeUrls.ts';

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

assert(
	resolveWebApiOrigin({
		webOrigin: 'https://repdraft-zeta.vercel.app/',
		siteUrl: 'https://other.test'
	}) === 'https://repdraft-zeta.vercel.app',
	'PUBLIC_WEB_ORIGIN wins and strips trailing slash'
);
assert(
	resolveWebApiOrigin({ siteUrl: 'https://repdraft-zeta.vercel.app' }) ===
		'https://repdraft-zeta.vercel.app',
	'PUBLIC_SITE_URL used when WEB_ORIGIN empty'
);
assert(
	resolveWebApiOrigin({ siteUrl: 'not-a-url', browserOrigin: 'http://127.0.0.1:5173/' }) ===
		'http://127.0.0.1:5173',
	'falls back to browser origin'
);
assert(resolveWebApiOrigin({}) === '', 'empty when nothing configured');

assert(isAuthDeepLinkUrl('https://repdraft-zeta.vercel.app/auth'), 'https /auth');
assert(isAuthDeepLinkUrl('http://127.0.0.1:5173/auth?recovery=1'), 'http /auth local');
assert(
	!isAuthDeepLinkUrl('https://repdraft-zeta.vercel.app/workouts'),
	'https non-auth ignored'
);
assert(!isAuthDeepLinkUrl('repdraft://auth'), 'custom scheme ignored');
assert(!isAuthDeepLinkUrl('not a url'), 'junk ignored');

assert(webAnalyticsAvailable({ browser: true }) === true, 'web may show analytics');
assert(webAnalyticsAvailable({ browser: false }) === false, 'SSR never analytics');

console.log('nativeUrls.selfcheck: ok');
