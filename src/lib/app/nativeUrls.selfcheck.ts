import {
	isAuthDeepLinkUrl,
	resolveWebApiOrigin,
	webAnalyticsAvailable
} from './nativeUrls.ts';

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

assert(
	resolveWebApiOrigin({ webOrigin: 'https://repdraft.app/', siteUrl: 'https://other.test' }) ===
		'https://repdraft.app',
	'PUBLIC_WEB_ORIGIN wins and strips trailing slash'
);
assert(
	resolveWebApiOrigin({ siteUrl: 'https://repdraft.app' }) === 'https://repdraft.app',
	'PUBLIC_SITE_URL used when WEB_ORIGIN empty'
);
assert(
	resolveWebApiOrigin({ siteUrl: 'not-a-url', browserOrigin: 'http://127.0.0.1:5173/' }) ===
		'http://127.0.0.1:5173',
	'falls back to browser origin'
);
assert(resolveWebApiOrigin({}) === '', 'empty when nothing configured');

assert(isAuthDeepLinkUrl('repdraft://auth'), 'custom scheme host auth');
assert(isAuthDeepLinkUrl('repdraft://auth?code=abc'), 'custom scheme with query');
assert(isAuthDeepLinkUrl('repdraft:///auth#access_token=x'), 'custom scheme path auth');
assert(isAuthDeepLinkUrl('https://repdraft.app/auth'), 'https /auth');
assert(isAuthDeepLinkUrl('http://127.0.0.1:5173/auth?recovery=1'), 'http /auth local');
assert(!isAuthDeepLinkUrl('https://repdraft.app/workouts'), 'https non-auth ignored');
assert(!isAuthDeepLinkUrl('repdraft://workouts'), 'custom scheme other host ignored');
assert(!isAuthDeepLinkUrl('not a url'), 'junk ignored');

assert(webAnalyticsAvailable({ browser: true, native: false }) === true, 'web may show analytics');
assert(webAnalyticsAvailable({ browser: true, native: true }) === false, 'native never analytics');
assert(webAnalyticsAvailable({ browser: false, native: false }) === false, 'SSR never analytics');

console.log('nativeUrls.selfcheck: ok');
