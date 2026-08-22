/** App color scheme. Tokens for `[data-theme='light']` live in `routes/layout.css`. */
export type AppTheme = 'dark' | 'light';

export const DEFAULT_APP_THEME: AppTheme = 'light';

export const THEME_STORAGE_KEY = 'repdraft.theme';

export const THEME_META_COLORS: Record<AppTheme, string> = {
	dark: '#0A0A0D',
	light: '#F7F5FC'
};

export function parseAppTheme(value: string | null | undefined): AppTheme | null {
	if (value === 'dark' || value === 'light') return value;
	return null;
}

/** First visit / SSR: light. OS preference is not applied — user toggles explicitly. */
export function systemPreferredTheme(): AppTheme {
	return DEFAULT_APP_THEME;
}
