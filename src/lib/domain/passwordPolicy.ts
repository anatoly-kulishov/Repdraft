/** Client + dashboard aligned password rules (NIST-like length + letter/digit). */
export const PASSWORD_MIN_LENGTH = 10;

export type PasswordPolicyReason =
	| 'ok'
	| 'tooShort'
	| 'needLetter'
	| 'needDigit'
	| 'matchesEmail';

const LETTER_RE = /\p{L}/u;
const DIGIT_RE = /\p{N}/u;

function emailLocalPart(email: string | null | undefined): string {
	const raw = (email ?? '').trim().toLowerCase();
	if (!raw.includes('@')) return raw;
	return raw.split('@')[0] ?? '';
}

/** Sync policy checks (no network). Call HIBP separately for signup/recovery. */
export function validatePasswordPolicy(
	password: string,
	email?: string | null
): PasswordPolicyReason {
	if (password.length < PASSWORD_MIN_LENGTH) return 'tooShort';
	if (!LETTER_RE.test(password)) return 'needLetter';
	if (!DIGIT_RE.test(password)) return 'needDigit';
	const local = emailLocalPart(email);
	if (local.length >= 3 && password.toLowerCase().includes(local)) return 'matchesEmail';
	return 'ok';
}

export function passwordPolicyMessageKey(reason: Exclude<PasswordPolicyReason, 'ok'>): string {
	switch (reason) {
		case 'tooShort':
			return 'auth.errors.passwordTooShort';
		case 'needLetter':
			return 'auth.errors.passwordNeedLetter';
		case 'needDigit':
			return 'auth.errors.passwordNeedDigit';
		case 'matchesEmail':
			return 'auth.errors.passwordMatchesEmail';
		default: {
			const _exhaustive: never = reason;
			return _exhaustive;
		}
	}
}

export function passwordPolicyChecklist(password: string, email?: string | null) {
	const local = emailLocalPart(email);
	return {
		minLength: password.length >= PASSWORD_MIN_LENGTH,
		hasLetter: LETTER_RE.test(password),
		hasDigit: DIGIT_RE.test(password),
		notEmail:
			password.length === 0
				? false
				: local.length < 3 || !password.toLowerCase().includes(local)
	};
}
