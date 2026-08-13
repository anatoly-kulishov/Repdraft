import { userFirstName, type AuthUserLike } from './authFlow';

export const GREETING_NAME_MAX = 32;

export function sanitizeGreetingName(raw: string): string {
	return raw.trim().replace(/\s+/g, ' ').slice(0, GREETING_NAME_MAX);
}

/** Custom greeting name wins; else first token from auth profile / email. */
export function greetingFirstName(
	customName: string | null | undefined,
	user: AuthUserLike | null | undefined
): string | null {
	const custom = sanitizeGreetingName(customName ?? '');
	if (custom) return custom.split(/\s+/)[0] || null;
	return userFirstName(user);
}

export function runGreetingNameSelfCheck(): void {
	if (sanitizeGreetingName('  Ada   Lovelace  ') !== 'Ada Lovelace') {
		throw new Error('sanitizeGreetingName should trim and collapse spaces');
	}
	if (sanitizeGreetingName('x'.repeat(40)).length !== GREETING_NAME_MAX) {
		throw new Error('sanitizeGreetingName should cap length');
	}
	if (
		greetingFirstName('Маша', { user_metadata: { full_name: 'Google Name' } }) !== 'Маша'
	) {
		throw new Error('greetingFirstName should prefer custom name');
	}
	if (
		greetingFirstName('', { user_metadata: { full_name: 'Anatoly Kulishov' } }) !== 'Anatoly'
	) {
		throw new Error('greetingFirstName should fall back to auth name');
	}
}
