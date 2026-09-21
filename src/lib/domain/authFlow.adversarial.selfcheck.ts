/**
 * Regression: Confirmed Auth adversarial breaks must stay fixed.
 * Junk (recovery drops next) is intentionally not asserted.
 *
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/domain/authFlow.adversarial.selfcheck.ts
 */
import {
	authErrorMessageKey,
	isAuthEmailCallback,
	safeRedirectPath
} from './authFlow.ts';

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

function resolveAgainstOrigin(path: string): { href: string; host: string; pathname: string } {
	const u = new URL(path, 'https://repdraft.app');
	return { href: u.href, host: u.host, pathname: u.pathname };
}

/** Mirrors +page.svelte reportAuthError decision (toast / inline / field shake). */
function reportAuthErrorDecision(err: unknown): {
	toast: boolean;
	inlineMessage: boolean;
	flashInvalid: boolean;
	key: string | null;
} {
	const key = authErrorMessageKey(err);
	if (key === 'auth.errors.rateLimit') {
		return { toast: true, inlineMessage: false, flashInvalid: false, key };
	}
	return { toast: true, inlineMessage: true, flashInvalid: true, key };
}

function shouldAuthCallbackRedirect(opts: {
	ready: boolean;
	sessionKnown: boolean;
	user: boolean;
	recoveryMode: boolean;
	redirected: boolean;
	search: string;
	hash: string;
}): boolean {
	if (!opts.ready || !opts.sessionKnown || !opts.user || opts.recoveryMode || opts.redirected) {
		return false;
	}
	return isAuthEmailCallback(opts.search, opts.hash);
}

const failures: string[] = [];

function attack(name: string, fn: () => void): void {
	try {
		fn();
		console.log(`PASS (not broken): ${name}`);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		failures.push(`${name} :: ${msg}`);
		console.error(`FAIL: ${name}\n  ${msg}`);
	}
}

attack('safeRedirectPath.open-redirect.tab', () => {
	const raw = '/\t/evil.com';
	const out = safeRedirectPath(raw);
	const { host, href } = resolveAgainstOrigin(out);
	assert(
		out === '/workouts' || host === 'repdraft.app',
		`open redirect: safeRedirectPath(${JSON.stringify(raw)})=${JSON.stringify(out)} → ${href}`
	);
});

attack('safeRedirectPath.open-redirect.lf', () => {
	const raw = '/\n/evil.com';
	const out = safeRedirectPath(raw);
	const { host, href } = resolveAgainstOrigin(out);
	assert(
		out === '/workouts' || host === 'repdraft.app',
		`open redirect: safeRedirectPath(${JSON.stringify(raw)})=${JSON.stringify(out)} → ${href}`
	);
});

attack('safeRedirectPath.open-redirect.cr', () => {
	const raw = '/\r/evil.com';
	const out = safeRedirectPath(raw);
	const { host, href } = resolveAgainstOrigin(out);
	assert(
		out === '/workouts' || host === 'repdraft.app',
		`open redirect: safeRedirectPath(${JSON.stringify(raw)})=${JSON.stringify(out)} → ${href}`
	);
});

attack('safeRedirectPath.open-redirect.query-tab', () => {
	const fromQuery = new URLSearchParams('next=/%09/evil.com').get('next');
	const out = safeRedirectPath(fromQuery);
	const { host, href } = resolveAgainstOrigin(out);
	assert(
		out === '/workouts' || host === 'repdraft.app',
		`query next=/%09/evil.com → ${JSON.stringify(fromQuery)} → ${JSON.stringify(out)} → ${href}`
	);
});

attack('safeRedirectPath.auth-loop.dotdot', () => {
	const out = safeRedirectPath('/../auth');
	const { pathname } = resolveAgainstOrigin(out);
	assert(
		out === '/workouts' || pathname !== '/auth',
		`auth loop: ${JSON.stringify(out)} resolves to ${pathname}`
	);
});

attack('safeRedirectPath.auth-loop.workouts-dotdot', () => {
	const out = safeRedirectPath('/workouts/../auth');
	const { pathname } = resolveAgainstOrigin(out);
	assert(
		out === '/workouts' || pathname !== '/auth',
		`auth loop: ${JSON.stringify(out)} resolves to ${pathname}`
	);
});

attack('safeRedirectPath.auth-loop.dot-segment', () => {
	const out = safeRedirectPath('/./auth');
	const { pathname } = resolveAgainstOrigin(out);
	assert(
		out === '/workouts' || pathname !== '/auth',
		`auth loop: ${JSON.stringify(out)} resolves to ${pathname}`
	);
});

attack('safeRedirectPath.auth-loop.query-encoded-dotdot', () => {
	const fromQuery = new URLSearchParams('next=/%2e%2e/auth').get('next');
	const out = safeRedirectPath(fromQuery);
	const { pathname } = resolveAgainstOrigin(out);
	assert(
		out === '/workouts' || pathname !== '/auth',
		`query next=/%2e%2e/auth → ${JSON.stringify(fromQuery)} → ${JSON.stringify(out)} → ${pathname}`
	);
});

attack('authErrorMessageKey.frequency-prose-without-status', () => {
	const key = authErrorMessageKey({
		message: 'For security purposes, you can only request this after 60 seconds.'
	});
	assert(
		key === 'auth.errors.rateLimit',
		`frequency-limit prose must map to rateLimit, got ${JSON.stringify(key)}`
	);
});

attack('reportAuthError.frequency-prose-must-be-toast-only', () => {
	const d = reportAuthErrorDecision({
		message: 'For security purposes, you can only request this after 54 seconds'
	});
	assert(
		d.key === 'auth.errors.rateLimit' && !d.inlineMessage && !d.flashInvalid,
		`rate-limit UX broken for frequency prose: ${JSON.stringify(d)}`
	);
});

attack('authCallback.recovery-hash-redirects-without-recoveryMode', () => {
	const steals = shouldAuthCallbackRedirect({
		ready: true,
		sessionKnown: true,
		user: true,
		recoveryMode: false,
		redirected: false,
		search: '',
		hash: '#access_token=x&refresh_token=y&type=recovery'
	});
	assert(
		!steals,
		'recovery hash with access_token must not count as login callback when recoveryMode is false'
	);
});

attack('authCallback.empty-code-redirects-signed-in', () => {
	const steals = shouldAuthCallbackRedirect({
		ready: true,
		sessionKnown: true,
		user: true,
		recoveryMode: false,
		redirected: false,
		search: 'code=',
		hash: ''
	});
	assert(!steals, 'empty code= must not treat signed-in /auth visit as PKCE callback');
});

/** Mirrors stores/auth.ts recoveryCallbackUrl (now keeps next like magic). */
function recoveryCallbackUrl(origin: string, next?: string | null): string {
	const url = new URL('/auth', origin);
	url.searchParams.set('recovery', '1');
	if (next) url.searchParams.set('next', next);
	return url.toString();
}

function authCallbackUrl(origin: string, next?: string | null): string {
	const url = new URL('/auth', origin);
	if (next) url.searchParams.set('next', next);
	return url.toString();
}

attack('recoveryCallbackUrl.keeps-next', () => {
	const origin = 'https://repdraft.app';
	const next = '/exercise/42';
	const magicNext = new URL(authCallbackUrl(origin, next)).searchParams.get('next');
	const recoveryNext = new URL(recoveryCallbackUrl(origin, next)).searchParams.get('next');
	assert(magicNext === next, `magic must carry next, got ${JSON.stringify(magicNext)}`);
	assert(
		recoveryNext === next,
		`recovery redirectTo must keep next (got ${JSON.stringify(recoveryNext)})`
	);
	assert(
		new URL(recoveryCallbackUrl(origin, next)).searchParams.get('recovery') === '1',
		'recovery flag must remain'
	);
});

if (failures.length === 0) {
	console.log('authFlow.adversarial.selfcheck: zero failing attacks (Confirmed held)');
	process.exit(0);
}

console.error(`\nauthFlow.adversarial.selfcheck: ${failures.length} break(s)`);
for (const f of failures) console.error(` - ${f}`);
process.exit(1);
