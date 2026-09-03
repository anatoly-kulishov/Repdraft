import { passwordPolicyMessageKey, validatePasswordPolicy } from '$lib/domain/passwordPolicy';
import { isPasswordPwned } from '$lib/security/pwnedPasswords';

/** Sync policy + HIBP (fail-closed when HIBP unreachable). */
export async function assertStrongPassword(password: string, email?: string | null): Promise<void> {
	const reason = validatePasswordPolicy(password, email);
	if (reason !== 'ok') {
		throw new Error(passwordPolicyMessageKey(reason));
	}
	const pwned = await isPasswordPwned(password);
	if (pwned === true) {
		throw new Error('auth.errors.passwordPwned');
	}
	if (pwned === null) {
		throw new Error('auth.errors.passwordCheckUnavailable');
	}
}
