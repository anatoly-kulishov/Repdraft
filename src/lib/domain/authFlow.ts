import {
	PASSWORD_MIN_LENGTH,
	passwordPolicyChecklist,
	passwordPolicyMessageKey,
	validatePasswordPolicy,
	type PasswordPolicyReason
} from './passwordPolicy';
import { md5Hex } from './md5';

export {
	PASSWORD_MIN_LENGTH,
	passwordPolicyChecklist,
	passwordPolicyMessageKey,
	validatePasswordPolicy,
	type PasswordPolicyReason
};

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
	if (message.includes('captcha') || code === 'captcha_failed') {
		return 'auth.errors.captchaFailed';
	}

	return null;
}

/** Minimal user shape for display helpers (Supabase User compatible). */
export type AuthUserLike = {
	email?: string | null;
	user_metadata?: Record<string, unknown> | null;
	app_metadata?: Record<string, unknown> | null;
	identities?: Array<{ provider?: string | null }> | null;
};

function metaString(meta: Record<string, unknown> | null | undefined, key: string): string | null {
	const raw = meta?.[key];
	if (typeof raw !== 'string') return null;
	const value = raw.trim();
	return value || null;
}

/** Gravatar image URL for an email (`d=404` so missing avatars fail into initials). */
export function gravatarAvatarUrl(email: string, size = 192): string {
	const hash = md5Hex(email.trim().toLowerCase());
	return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}

/**
 * Avatar URL: OAuth `avatar_url` / `picture`, else Gravatar from email.
 * Missing Gravatar returns 404 → UI `onerror` falls back to initials.
 */
export function userAvatarUrl(user: AuthUserLike | null | undefined): string | null {
	if (!user) return null;
	const meta = user.user_metadata;
	for (const key of ['avatar_url', 'picture'] as const) {
		const url = metaString(meta, key);
		if (!url) continue;
		if (url.startsWith('https://') || url.startsWith('http://')) {
			return url;
		}
	}
	const email = user.email?.trim();
	if (!email) return null;
	return gravatarAvatarUrl(email);
}

/** Prefer full_name / name from metadata, else email local-part. */
export function userDisplayName(user: AuthUserLike | null | undefined): string | null {
	if (!user) return null;
	const meta = user.user_metadata;
	for (const key of ['full_name', 'name'] as const) {
		const name = metaString(meta, key);
		if (name) return name;
	}
	const email = user.email?.trim();
	if (!email) return null;
	return email.split('@')[0] || null;
}

/** Initials for avatar fallback (email local-part or display name). */
export function userInitials(user: AuthUserLike | null | undefined): string | null {
	if (!user) return null;
	const email = user.email?.trim();
	if (email) {
		const local = email.split('@')[0] ?? '';
		const parts = local.split(/[._\-+]/).filter(Boolean);
		if (parts.length >= 2) {
			const a = parts[0]![0] ?? '';
			const b = parts[1]![0] ?? '';
			const pair = `${a}${b}`.toUpperCase();
			if (pair) return pair;
		}
		const slice = local.slice(0, 2).toUpperCase();
		if (slice) return slice;
	}
	const name = userDisplayName(user);
	if (!name) return null;
	const tokens = name.trim().split(/\s+/).filter(Boolean);
	if (tokens.length >= 2) {
		return `${tokens[0]![0] ?? ''}${tokens[1]![0] ?? ''}`.toUpperCase() || null;
	}
	return name.slice(0, 2).toUpperCase() || null;
}

/** First token of display name — for home greeting ("Добрый день, Anatoly"). */
export function userFirstName(user: AuthUserLike | null | undefined): string | null {
	const name = userDisplayName(user);
	if (!name) return null;
	return name.trim().split(/\s+/)[0] || null;
}

/** Auth provider id: `email`, `github`, … from identities / app_metadata. */
export function userAuthProvider(user: AuthUserLike | null | undefined): string | null {
	if (!user) return null;
	const identity = user.identities?.find((row) => typeof row.provider === 'string' && row.provider.trim());
	if (identity?.provider) return identity.provider.trim().toLowerCase();
	const fromApp = metaString(user.app_metadata, 'provider');
	if (fromApp) return fromApp.toLowerCase();
	if (user.email?.trim()) return 'email';
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
	if (
		userAvatarUrl({
			user_metadata: { avatar_url: 'https://cdn.example.com/avatars/x.jpg' }
		}) !== 'https://cdn.example.com/avatars/x.jpg'
	) {
		throw new Error('userAvatarUrl should read avatar_url');
	}
	if (userAvatarUrl({ user_metadata: { avatar_url: 'javascript:alert(1)' } }) !== null) {
		throw new Error('userAvatarUrl should reject non-http URLs');
	}
	if (md5Hex('tekkenot95@gmail.com') !== 'fff616c939faa5ad954c0c91b6c4fe33') {
		throw new Error('md5Hex should match Gravatar email hash');
	}
	if (
		userAvatarUrl({ email: 'tekkenot95@gmail.com', user_metadata: {} }) !==
		'https://www.gravatar.com/avatar/fff616c939faa5ad954c0c91b6c4fe33?s=192&d=404'
	) {
		throw new Error('userAvatarUrl should fall back to Gravatar');
	}
	if (
		userAvatarUrl({
			email: 'tekkenot95@gmail.com',
			user_metadata: { avatar_url: 'https://cdn.example.com/avatars/x.jpg' }
		}) !== 'https://cdn.example.com/avatars/x.jpg'
	) {
		throw new Error('userAvatarUrl should prefer OAuth over Gravatar');
	}
	if (userDisplayName({ user_metadata: { full_name: 'Ada Lovelace' } }) !== 'Ada Lovelace') {
		throw new Error('userDisplayName should prefer full_name');
	}
	if (userDisplayName({ email: 'ada@example.com', user_metadata: {} }) !== 'ada') {
		throw new Error('userDisplayName should fall back to email local-part');
	}
	if (userInitials({ email: 'anatolkulishov@yandex.ru' }) !== 'AN') {
		throw new Error('userInitials should take 2 chars from single local-part');
	}
	if (userInitials({ email: 'anatoly.kulishov@yandex.ru' }) !== 'AK') {
		throw new Error('userInitials should use dotted local-part parts');
	}
	if (userFirstName({ user_metadata: { full_name: 'Anatoly Kulishov' } }) !== 'Anatoly') {
		throw new Error('userFirstName should use first token');
	}
	if (userAuthProvider({ identities: [{ provider: 'github' }] }) !== 'github') {
		throw new Error('userAuthProvider should read identities');
	}
	if (userAuthProvider({ email: 'a@b.c', identities: [] }) !== 'email') {
		throw new Error('userAuthProvider should fall back to email');
	}
	if (validatePasswordPolicy('short1') !== 'tooShort') {
		throw new Error('password policy: tooShort');
	}
	if (validatePasswordPolicy('abcdefghij') !== 'needDigit') {
		throw new Error('password policy: needDigit');
	}
	if (validatePasswordPolicy('1234567890') !== 'needLetter') {
		throw new Error('password policy: needLetter');
	}
	if (validatePasswordPolicy('anatoly12345', 'anatoly@example.com') !== 'matchesEmail') {
		throw new Error('password policy: matchesEmail');
	}
	if (validatePasswordPolicy('GoodPass12') !== 'ok') {
		throw new Error('password policy: ok');
	}
	if (passwordPolicyMessageKey('tooShort') !== 'auth.errors.passwordTooShort') {
		throw new Error('passwordPolicyMessageKey broken');
	}
}
