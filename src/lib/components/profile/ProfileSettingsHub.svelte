<script lang="ts">
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import ProfileSettingsSection from '$lib/components/profile/ProfileSettingsSection.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { athleteProfile } from '$lib/stores/prefs';
	import { appTheme } from '$lib/stores/theme';
	import {
		BookOpen,
		ChartBar,
		CloudArrowDown,
		CrownSimple,
		DeviceMobile,
		GearSix,
		House,
		ShieldCheck,
		UsersThree
	} from 'phosphor-svelte';

	let {
		signedIn = false,
		showPro = true,
		showCoach = false,
		showWorkout = true
	}: {
		signedIn?: boolean;
		showPro?: boolean;
		showCoach?: boolean;
		/** Rest sound / haptics (signed-in or guest with session prefs). */
		showWorkout?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let placeValue = $derived(
		translate(lang, $athleteProfile.trainingPlace === 'home' ? 'place.home' : 'place.gym')
	);
	let interfaceValue = $derived(
		[
			translate(lang, lang === 'ru' ? 'lang.ru' : 'lang.en'),
			translate(lang, $appTheme === 'light' ? 'settings.themeLight' : 'settings.themeDark')
		].join(', ')
	);
</script>

<div class="profile-settings-hub">
	<ProfileSettingsSection label={translate(lang, 'settings.group.account')}>
		<ProfileSettingsRow
			icon={House}
			label={translate(lang, 'settings.trainingProfileTitle')}
			value={placeValue}
			href="/auth/training"
		/>
		{#if showPro && signedIn}
			<ProfileSettingsRow
				icon={CrownSimple}
				iconTone="accent"
				label={translate(lang, 'billing.title')}
				href="/auth/pro"
			/>
		{/if}
		{#if showCoach && signedIn}
			<ProfileSettingsRow
				icon={UsersThree}
				label={translate(lang, 'profile.clients')}
				href="/auth/coach"
			/>
		{/if}
		{#if signedIn}
			<ProfileSettingsRow
				icon={ShieldCheck}
				label={translate(lang, 'settings.accountTitle')}
				href="/auth/account"
			/>
		{/if}
	</ProfileSettingsSection>

	<ProfileSettingsSection label={translate(lang, 'settings.group.preferences')}>
		{#if showWorkout}
			<ProfileSettingsRow
				icon={DeviceMobile}
				label={translate(lang, 'settings.sessionTitle')}
				href="/auth/workout"
			/>
		{/if}
		<ProfileSettingsRow
			icon={GearSix}
			label={translate(lang, 'settings.interfaceTitle')}
			value={interfaceValue}
			href="/auth/interface"
		/>
		<ProfileSettingsRow
			icon={ChartBar}
			label={translate(lang, 'progress.sectionTitle')}
			href="/auth/progress"
		/>
	</ProfileSettingsSection>

	<ProfileSettingsSection label={translate(lang, 'settings.group.support')}>
		<ProfileSettingsRow
			icon={CloudArrowDown}
			label={translate(lang, 'settings.exportTitle')}
			href="/auth/data"
		/>
		{#if !signedIn}
			<ProfileSettingsRow
				icon={BookOpen}
				label={translate(lang, 'settings.section.help')}
				href="/articles"
			/>
			<ProfileSettingsRow
				icon={ShieldCheck}
				label={translate(lang, 'privacy.link')}
				href="/privacy"
			/>
		{/if}
	</ProfileSettingsSection>
</div>
