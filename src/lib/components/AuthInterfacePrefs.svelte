<script lang="ts">
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import SegmentControl from '$lib/components/SegmentControl.svelte';
	import { parseAppTheme } from '$lib/domain/theme';
	import { isAppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { isWebAnalyticsAvailable } from '$lib/app/native';
	import { appTheme } from '$lib/stores/theme';
	import { resolvedLocale } from '$lib/stores/locale';
	import { webAnalyticsEnabled } from '$lib/stores/prefs';
	import { themeToggleStateIcon } from '$lib/components/icons/themeToggle';
	import { BarChart3, Globe } from '@lucide/svelte';

	let {
		surface = 'section'
	}: {
		/** Guest account stack vs signed-in profile panels. */
		surface?: 'section' | 'panel';
	} = $props();

	let lang = $derived($resolvedLocale);
	let theme = $derived($appTheme);
	let showWebAnalytics = $derived(isWebAnalyticsAvailable());
	let langOptions = $derived([
		{ id: 'ru', label: translate(lang, 'lang.ru') },
		{ id: 'en', label: translate(lang, 'lang.en') }
	]);
	let themeOptions = $derived([
		{ id: 'dark', label: translate(lang, 'settings.themeDark') },
		{ id: 'light', label: translate(lang, 'settings.themeLight') }
	]);
	let rootClass = $derived(
		surface === 'panel'
			? 'profile-settings-group panel profile-settings-group--paired'
			: 'auth-account__section'
	);
	let titleClass = $derived(
		surface === 'panel' ? 'profile-settings-group__title' : 'auth-prefs__title'
	);
	let stackClass = $derived(surface === 'panel' ? undefined : 'auth-prefs__stack');
	let hintClass = $derived(surface === 'panel' ? 'profile-settings-group__hint' : 'auth-prefs__hint');
</script>

<div class={rootClass}>
	<p class={titleClass}>{translate(lang, 'settings.interfaceTitle')}</p>
	<div class={stackClass}>
		<ProfileSettingsRow icon={Globe} label={translate(lang, 'lang.label')}>
			<SegmentControl
				options={langOptions}
				value={lang}
				ariaLabel={translate(lang, 'lang.label')}
				onchange={(id) => {
					if (isAppLocale(id)) resolvedLocale.set(id);
				}}
			/>
		</ProfileSettingsRow>
		<ProfileSettingsRow
			icon={themeToggleStateIcon(theme === 'light')}
			label={translate(lang, 'settings.theme')}
		>
			<SegmentControl
				options={themeOptions}
				value={theme}
				ariaLabel={translate(lang, 'settings.theme')}
				onchange={(id) => {
					const next = parseAppTheme(id);
					if (next) appTheme.set(next);
				}}
			/>
		</ProfileSettingsRow>
		{#if showWebAnalytics}
			<ProfileSettingsRow icon={BarChart3} label={translate(lang, 'settings.webAnalytics')}>
				<input
					type="checkbox"
					class="auth-pref-toggle__input profile-settings-row__toggle"
					checked={$webAnalyticsEnabled}
					aria-label={translate(lang, 'settings.webAnalytics')}
					onchange={(e) => {
						webAnalyticsEnabled.set((e.currentTarget as HTMLInputElement).checked);
					}}
				/>
			</ProfileSettingsRow>
		{/if}
	</div>
	{#if showWebAnalytics}
		<p class={hintClass}>{translate(lang, 'settings.webAnalyticsHint')}</p>
	{/if}
</div>
