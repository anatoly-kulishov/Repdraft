import { browser } from '$app/environment';
import {
	DEFAULT_APP_THEME,
	resolveInitialTheme,
	THEME_COOKIE,
	THEME_META_COLORS,
	THEME_STORAGE_KEY,
	type AppTheme
} from '$lib/domain/theme';
import { writable } from 'svelte/store';

function readOsPrefersLight(): boolean | null {
	if (!browser || typeof matchMedia !== 'function') return null;
	try {
		return matchMedia('(prefers-color-scheme: light)').matches;
	} catch {
		return null;
	}
}

function readStoredTheme(): AppTheme {
	if (!browser) return DEFAULT_APP_THEME;
	try {
		const raw = localStorage.getItem(THEME_STORAGE_KEY);
		return resolveInitialTheme(raw, readOsPrefersLight());
	} catch {
		return resolveInitialTheme(null, readOsPrefersLight());
	}
}

/** Update meta in place — remove/recreate flashes the iOS status bar. */
function writeMeta(name: string, content: string) {
	const existing = document.querySelector(`meta[name="${name}"]`);
	if (existing) {
		if (existing.getAttribute('content') !== content) {
			existing.setAttribute('content', content);
		}
		return;
	}
	const meta = document.createElement('meta');
	meta.setAttribute('name', name);
	meta.setAttribute('content', content);
	document.head.appendChild(meta);
}

/** Applies theme to `documentElement` and meta theme-color. */
export function applyAppTheme(theme: AppTheme) {
	if (!browser) return;
	const root = document.documentElement;
	root.dataset.theme = theme;
	root.classList.toggle('dark', theme === 'dark');
	const bg = THEME_META_COLORS[theme];
	root.style.setProperty('--boot-bg', bg);
	root.style.colorScheme = theme;
	root.style.backgroundColor = bg;
	document.body.style.backgroundColor = bg;
	writeMeta('theme-color', bg);
	writeMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
	try {
		document.cookie = `${THEME_COOKIE}=${theme}; path=/; Max-Age=31536000; SameSite=Lax`;
	} catch {
		/* ignore */
	}
}

function createThemeStore() {
	const store = writable<AppTheme>(readStoredTheme());

	if (browser) {
		store.subscribe((theme) => {
			try {
				localStorage.setItem(THEME_STORAGE_KEY, theme);
			} catch {
				/* ignore */
			}
			applyAppTheme(theme);
		});
	}

	return {
		subscribe: store.subscribe,
		set(theme: AppTheme) {
			store.set(theme);
		},
		toggle() {
			store.update((t) => (t === 'dark' ? 'light' : 'dark'));
		}
	};
}

export const appTheme = createThemeStore();
