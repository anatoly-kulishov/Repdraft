/** App color scheme. Tokens for `[data-theme='light']` live in `routes/layout.css`. */
export type AppTheme = 'dark' | 'light';

export const DEFAULT_APP_THEME: AppTheme = 'dark';

export const THEME_STORAGE_KEY = 'repdraft.theme';

/** Cookie mirror for SSR — kept in sync with localStorage in applyAppTheme + app.html boot. */
export const THEME_COOKIE = THEME_STORAGE_KEY;

export const THEME_META_COLORS: Record<AppTheme, string> = {
	dark: '#0B0B0C',
	light: '#F2F2F7'
};

export function parseAppTheme(value: string | null | undefined): AppTheme | null {
	if (value === 'dark' || value === 'light') return value;
	return null;
}

/**
 * First visit (nothing stored): follow OS when known, else dark.
 * After that the stored value wins until the user toggles.
 * `prefersLight` is from `prefers-color-scheme: light` (null = unknown / SSR).
 */
export function resolveInitialTheme(
	stored: string | null | undefined,
	prefersLight: boolean | null
): AppTheme {
	const parsed = parseAppTheme(stored);
	if (parsed) return parsed;
	if (prefersLight === true) return 'light';
	if (prefersLight === false) return 'dark';
	return DEFAULT_APP_THEME;
}
