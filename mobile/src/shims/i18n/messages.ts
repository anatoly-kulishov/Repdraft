import type { AppLocale } from './locale';

/** Subset used by domain labels (EN title-case helper). */
export function titleCaseEn(value: string): string {
	return value
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

/** Stub - RN UI uses its own copy; domain records helpers may call this. */
export function translate(
	_locale: AppLocale,
	key: string,
	vars?: Record<string, string | number>
): string {
	let text = key;
	if (vars) {
		for (const [name, value] of Object.entries(vars)) {
			text = text.replaceAll(`{${name}}`, String(value));
		}
	}
	return text;
}
