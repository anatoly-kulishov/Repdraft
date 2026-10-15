<script lang="ts">
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import { translate } from '$lib/i18n/messages';
	import { isWebAnalyticsAvailable } from '$lib/app/native';
	import { clampWeeklyGoal, MAX_WEEKLY_GOAL, MIN_WEEKLY_GOAL } from '$lib/domain/quest';
	import { appTheme } from '$lib/stores/theme';
	import { resolvedLocale } from '$lib/stores/locale';
	import { questEnabled, webAnalyticsEnabled } from '$lib/stores/prefs';
	import { quest, questState } from '$lib/stores/quest';
	import { themeToggleStateIcon } from '$lib/components/icons/themeToggle';
	import { BarChart3, Globe, Sparkles } from '@lucide/svelte';

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
	let showWebAnalytics = $derived(isWebAnalyticsAvailable());
	let weeklyGoal = $derived($questState.weeklyGoal);
	let nextWeeklyGoal = $derived(
		weeklyGoal >= MAX_WEEKLY_GOAL ? MIN_WEEKLY_GOAL : clampWeeklyGoal(weeklyGoal + 1)
	);
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
		<ProfileSettingsRow icon={Sparkles} label={translate(lang, 'settings.quest')}>
			<input
				type="checkbox"
				class="auth-pref-toggle__input profile-settings-row__toggle"
				checked={$questEnabled}
				aria-label={translate(lang, 'settings.quest')}
				onchange={(e) => {
					questEnabled.set((e.currentTarget as HTMLInputElement).checked);
				}}
			/>
		</ProfileSettingsRow>
		{#if $questEnabled}
			<ProfileSettingsRow
				icon={Sparkles}
				label={translate(lang, 'settings.questWeeklyGoal')}
				value={String(weeklyGoal)}
				ariaLabel={translate(lang, 'settings.questWeeklyGoalCycle', {
					current: String(weeklyGoal),
					next: String(nextWeeklyGoal)
				})}
				onclick={() => quest.setWeeklyGoal(nextWeeklyGoal)}
			/>
		{/if}
	</div>
	{#if showWebAnalytics}
		<p class={hintClass}>{translate(lang, 'settings.webAnalyticsHint')}</p>
	{/if}
	<p class={hintClass}>{translate(lang, 'settings.questHint')}</p>
</div>
