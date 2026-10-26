import { MoonStars, SunDim } from 'phosphor-svelte';
import type { IconComponentProps } from 'phosphor-svelte';
import type { Component } from 'svelte';

type ThemeIcon = Component<IconComponentProps>;

/** Header toggle: icon for the theme you switch *to*. */
export function themeToggleActionIcon(isLight: boolean): ThemeIcon {
	return isLight ? MoonStars : SunDim;
}

/** Settings row: icon for the theme that is *active*. */
export function themeToggleStateIcon(isLight: boolean): ThemeIcon {
	return isLight ? SunDim : MoonStars;
}
