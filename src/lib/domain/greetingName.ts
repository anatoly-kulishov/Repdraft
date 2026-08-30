import { userFirstName, type AuthUserLike } from './authFlow';

/** Max length stored for custom greeting name (profile field). */
export const GREETING_NAME_MAX = 24;

/** Max length shown in «Добрый день, {name}» — long tokens must not blow the layout. */
export const GREETING_DISPLAY_MAX = 18;

export function sanitizeGreetingName(raw: string): string {
	return (
		raw
			/* Format marks: zero-width, bidi controls, soft hyphen — layout/edge junk. */
			.replace(/\p{Cf}+/gu, '')
			/* Other controls (tab/newline/NUL) → space so tokens do not glue. */
			.replace(/\p{Cc}+/gu, ' ')
			.trim()
			.replace(/\s+/g, ' ')
			.slice(0, GREETING_NAME_MAX)
	);
}

/** While typing: strip format/control chars, hard-cap length (no trim — keeps caret stable). */
export function clampGreetingName(raw: string, maxLen = GREETING_NAME_MAX): string {
	return raw.replace(/\p{Cf}+/gu, '').replace(/\p{Cc}+/gu, ' ').slice(0, maxLen);
}

/** True when sanitized input matches stored custom name (empty = no custom name). */
export function greetingNameMatchesStored(
	stored: string | null | undefined,
	raw: string
): boolean {
	return sanitizeGreetingName(stored ?? '') === sanitizeGreetingName(raw);
}

/** Truncate a single display token without mid-word junk when short enough. */
export function truncateGreetingToken(raw: string, max = GREETING_DISPLAY_MAX): string {
	const token = raw.trim();
	if (!token) return '';
	if (token.length <= max) return token;
	return `${token.slice(0, Math.max(1, max - 1))}…`;
}

/** Custom greeting name wins; else first token from auth profile / email. */
export function greetingFirstName(
	customName: string | null | undefined,
	user: AuthUserLike | null | undefined
): string | null {
	const custom = sanitizeGreetingName(customName ?? '');
	if (custom) {
		const first = custom.split(/\s+/)[0] || '';
		const shown = truncateGreetingToken(first);
		return shown || null;
	}
	const fromAuth = userFirstName(user);
	if (!fromAuth) return null;
	const shown = truncateGreetingToken(fromAuth);
	return shown || null;
}

export function runGreetingNameSelfCheck(): void {
	if (sanitizeGreetingName('  Ada   Lovelace  ') !== 'Ada Lovelace') {
		throw new Error('sanitizeGreetingName should trim and collapse spaces');
	}
	if (sanitizeGreetingName('Ada\n\tLovelace') !== 'Ada Lovelace') {
		throw new Error('sanitizeGreetingName should turn control whitespace into spaces');
	}
	if (sanitizeGreetingName(`Ada\u200B\uFEFFLovelace`) !== 'AdaLovelace') {
		throw new Error('sanitizeGreetingName should strip zero-width / BOM');
	}
	if (sanitizeGreetingName('x'.repeat(40)).length !== GREETING_NAME_MAX) {
		throw new Error('sanitizeGreetingName should cap length');
	}
	if (!greetingNameMatchesStored('Ada', '  Ada  ')) {
		throw new Error('greetingNameMatchesStored should compare sanitized values');
	}
	if (clampGreetingName('  Ada  ').length !== 6) {
		throw new Error('clampGreetingName keeps spaces while typing');
	}
	if (clampGreetingName(`Ada\u200BLovelace`).length !== 11) {
		throw new Error('clampGreetingName strips zero-width chars');
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
	const long = 'А'.repeat(30);
	const shown = greetingFirstName(long, null);
	if (!shown || shown.length > GREETING_DISPLAY_MAX || !shown.endsWith('…')) {
		throw new Error(`greetingFirstName should truncate long tokens, got ${JSON.stringify(shown)}`);
	}
	if (truncateGreetingToken('Short') !== 'Short') {
		throw new Error('truncateGreetingToken should keep short tokens');
	}
}
