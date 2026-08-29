import { MoonStar, SunMedium } from '@lucide/svelte';
import type { Component } from 'svelte';

type ThemeIcon = Component<{ size?: number | string; strokeWidth?: number | string }>;

/** Header toggle: icon for the theme you switch *to*. */
export function themeToggleActionIcon(isLight: boolean): ThemeIcon {
	return isLight ? MoonStar : SunMedium;
}

/** Settings row: icon for the theme that is *active*. */
export function themeToggleStateIcon(isLight: boolean): ThemeIcon {
	return isLight ? SunMedium : MoonStar;
}
