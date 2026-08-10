/** App color scheme. Tokens for `[data-theme='light']` live in `routes/layout.css`. */
export type AppTheme = 'dark' | 'light';

export const DEFAULT_APP_THEME: AppTheme = 'dark';

export const THEME_STORAGE_KEY = 'repdraft.theme';

export const THEME_META_COLORS: Record<AppTheme, string> = {
	dark: '#0B0B0C',
	light: '#E8ECF0'
};

export function parseAppTheme(value: string | null | undefined): AppTheme | null {
	if (value === 'dark' || value === 'light') return value;
	return null;
}

export function systemPreferredTheme(): AppTheme {
	if (typeof matchMedia === 'undefined') return DEFAULT_APP_THEME;
	return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : DEFAULT_APP_THEME;
}
