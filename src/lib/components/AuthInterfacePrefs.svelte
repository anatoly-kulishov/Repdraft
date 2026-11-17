<script lang="ts">
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import ProfileSettingsSection from '$lib/components/profile/ProfileSettingsSection.svelte';
	import { translate } from '$lib/i18n/messages';
	import { appTheme } from '$lib/stores/theme';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Globe, MoonStars, SunDim } from 'phosphor-svelte';

	let {
		surface = 'section'
	}: {
		/** Guest account stack vs signed-in profile panels. */
		surface?: 'section' | 'panel';
	} = $props();

	let lang = $derived($resolvedLocale);
	let nextLang = $derived(lang === 'ru' ? ('en' as const) : ('ru' as const));
	let theme = $derived($appTheme);
	let nextTheme = $derived(theme === 'dark' ? ('light' as const) : ('dark' as const));
	let themeIcon = $derived(theme === 'light' ? SunDim : MoonStars);
</script>

{#if surface === 'panel'}
	<ProfileSettingsSection>
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
			icon={themeIcon}
			label={translate(lang, 'settings.theme')}
			value={translate(lang, theme === 'light' ? 'settings.themeLight' : 'settings.themeDark')}
			ariaLabel={translate(lang, 'settings.cycleHint', {
				label: translate(lang, 'settings.theme'),
				current: translate(lang, theme === 'light' ? 'settings.themeLight' : 'settings.themeDark'),
				next: translate(lang, nextTheme === 'light' ? 'settings.themeLight' : 'settings.themeDark')
			})}
			onclick={() => appTheme.set(nextTheme)}
		/>
	</ProfileSettingsSection>
{:else}
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
				icon={themeIcon}
				label={translate(lang, 'settings.theme')}
				value={translate(lang, theme === 'light' ? 'settings.themeLight' : 'settings.themeDark')}
				ariaLabel={translate(lang, 'settings.cycleHint', {
					label: translate(lang, 'settings.theme'),
					current: translate(
						lang,
						theme === 'light' ? 'settings.themeLight' : 'settings.themeDark'
					),
					next: translate(
						lang,
						nextTheme === 'light' ? 'settings.themeLight' : 'settings.themeDark'
					)
				})}
				onclick={() => appTheme.set(nextTheme)}
			/>
		</div>
	</div>
{/if}
