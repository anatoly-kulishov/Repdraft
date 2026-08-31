<script lang="ts">
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import { translate } from '$lib/i18n/messages';
	import { appTheme } from '$lib/stores/theme';
	import { resolvedLocale } from '$lib/stores/locale';
	import { themeToggleStateIcon } from '$lib/components/icons/themeToggle';
	import { Globe } from '@lucide/svelte';

	let lang = $derived($resolvedLocale);
	let nextLang = $derived(lang === 'ru' ? ('en' as const) : ('ru' as const));
	let theme = $derived($appTheme);
	let nextTheme = $derived(theme === 'dark' ? ('light' as const) : ('dark' as const));
</script>

<div class="auth-account__section">
	<p class="auth-prefs__title">{translate(lang, 'settings.interfaceTitle')}</p>
	<div class="auth-prefs__stack">
		<ProfileSettingsRow
			icon={Globe}
			label={translate(lang, 'lang.label')}
			value={translate(lang, lang === 'ru' ? 'lang.ru' : 'lang.en')}
			ariaLabel={translate(lang, 'settings.cycleHint', {
				label: translate(lang, 'lang.label'),
				current: translate(lang, lang === 'ru' ? 'lang.ru' : 'lang.en'),
				next: translate(lang, nextLang === 'ru' ? 'lang.ru' : 'lang.en')
			})}
			onclick={() => resolvedLocale.set(nextLang)}
		/>
		<ProfileSettingsRow
			icon={themeToggleStateIcon(theme === 'light')}
			label={translate(lang, 'settings.theme')}
			value={translate(lang, theme === 'light' ? 'settings.themeLight' : 'settings.themeDark')}
			ariaLabel={translate(lang, 'settings.cycleHint', {
				label: translate(lang, 'settings.theme'),
				current: translate(lang, theme === 'light' ? 'settings.themeLight' : 'settings.themeDark'),
				next: translate(lang, nextTheme === 'light' ? 'settings.themeLight' : 'settings.themeDark')
			})}
			onclick={() => appTheme.set(nextTheme)}
		/>
	</div>
	<p class="mt-2 text-xs text-[var(--color-muted)]">
		{translate(lang, 'settings.themeHint')}
	</p>
	<p class="mt-1 text-xs text-[var(--color-muted)]">{translate(lang, 'lang.hint')}</p>
</div>
