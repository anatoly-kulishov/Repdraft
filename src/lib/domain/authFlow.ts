/** Same-origin path for post-login redirect (blocks open redirects). */
export function safeRedirectPath(raw: string | null | undefined, fallback = '/workouts'): string {
	if (!raw) return fallback;
	const path = raw.trim();
	if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return fallback;
	if (path.startsWith('/auth')) return fallback;
	return path;
}

export function passwordsMatch(a: string, b: string): boolean {
	return a.length > 0 && a === b;
}

/** Map Supabase AuthError (and similar) to i18n message keys. */
export function authErrorMessageKey(err: unknown): string | null {
	if (!err || typeof err !== 'object') return null;

	const code =
		'code' in err && typeof (err as { code: unknown }).code === 'string'
			? (err as { code: string }).code.toLowerCase()
			: '';
	const status =
		'status' in err && typeof (err as { status: unknown }).status === 'number'
			? (err as { status: number }).status
			: 0;
	const message =
		'message' in err && typeof (err as { message: unknown }).message === 'string'
			? (err as { message: string }).message.toLowerCase()
			: '';

	if (
		code === 'invalid_credentials' ||
		message.includes('invalid login credentials') ||
		message.includes('invalid credentials')
	) {
		return 'auth.errors.invalidCredentials';
	}
	if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
		return 'auth.errors.emailNotConfirmed';
	}
	if (
		code === 'user_already_exists' ||
		code === 'email_exists' ||
		message.includes('already registered') ||
		message.includes('user already registered')
	) {
		return 'auth.errors.alreadyRegistered';
	}
	if (
		code === 'weak_password' ||
		message.includes('password should be at least') ||
		message.includes('weak password')
	) {
		return 'auth.errors.weakPassword';
	}
	if (
		code === 'over_email_send_rate_limit' ||
		code === 'over_request_rate_limit' ||
		status === 429 ||
		message.includes('rate limit') ||
		message.includes('too many requests')
	) {
		return 'auth.errors.rateLimit';
	}
	if (code === 'otp_expired' || message.includes('otp_expired') || message.includes('expired')) {
		return 'auth.errors.linkExpired';
	}
	if (message.includes('signups not allowed') || message.includes('signup is disabled')) {
		return 'auth.errors.signupDisabled';
	}
	if (message.includes('provider is not enabled') || message.includes('unsupported provider')) {
		return 'auth.errors.providerOff';
	}
	if (code === 'same_password' || message.includes('same password')) {
		return 'auth.errors.samePassword';
	}

	return null;
}

export function runAuthFlowSelfCheck(): void {
	if (safeRedirectPath('/workouts') !== '/workouts') {
		throw new Error('safeRedirectPath keeps relative path');
	}
	if (safeRedirectPath('https://evil.test') !== '/workouts') {
		throw new Error('safeRedirectPath rejects absolute URL');
	}
	if (safeRedirectPath('//evil.test') !== '/workouts') {
		throw new Error('safeRedirectPath rejects protocol-relative');
	}
	if (safeRedirectPath('/auth?x=1') !== '/workouts') {
		throw new Error('safeRedirectPath rejects /auth loops');
	}
	if (safeRedirectPath('/exercise/1') !== '/exercise/1') {
		throw new Error('safeRedirectPath allows app paths');
	}
	if (!passwordsMatch('abc123', 'abc123') || passwordsMatch('a', 'b')) {
		throw new Error('passwordsMatch broken');
	}
	if (
		authErrorMessageKey({ message: 'Invalid login credentials' }) !==
		'auth.errors.invalidCredentials'
	) {
		throw new Error('auth error map: credentials');
	}
	if (authErrorMessageKey({ code: 'email_not_confirmed' }) !== 'auth.errors.emailNotConfirmed') {
		throw new Error('auth error map: confirm');
	}
}
