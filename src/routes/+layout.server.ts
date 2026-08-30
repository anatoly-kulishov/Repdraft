import { parseAppTheme, DEFAULT_APP_THEME, THEME_COOKIE } from '$lib/domain/theme';
import type { LayoutServerLoad } from './$types';

/** SSR theme matches cookie so shell chrome does not flash the wrong mode. */
export const load: LayoutServerLoad = ({ cookies }) => {
	const theme = parseAppTheme(cookies.get(THEME_COOKIE)) ?? DEFAULT_APP_THEME;
	return { theme };
};
