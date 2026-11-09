<script lang="ts">
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
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
</script>

<div class="profile-settings-group panel profile-settings-hub">
	<p class="profile-settings-group__title">{translate(lang, 'settings.title')}</p>
	<p class="profile-settings-group__hint">{translate(lang, 'settings.hubLead')}</p>

	{#if showWorkout}
		<ProfileSettingsRow
			icon={DeviceMobile}
			label={translate(lang, 'settings.sessionTitle')}
			hint={translate(lang, 'settings.section.workoutHint')}
			href="/auth/workout"
		/>
	{/if}
	<ProfileSettingsRow
		icon={House}
		label={translate(lang, 'settings.trainingProfileTitle')}
		hint={translate(lang, 'settings.section.trainingHint')}
		href="/auth/training"
	/>
	<ProfileSettingsRow
		icon={GearSix}
		label={translate(lang, 'settings.interfaceTitle')}
		hint={translate(lang, 'settings.section.interfaceHint')}
		href="/auth/interface"
	/>
	<ProfileSettingsRow
		icon={ChartBar}
		label={translate(lang, 'progress.sectionTitle')}
		hint={translate(lang, 'settings.section.progressHint')}
		href="/auth/progress"
	/>
	{#if showPro && signedIn}
		<ProfileSettingsRow
			icon={CrownSimple}
			iconTone="accent"
			label={translate(lang, 'billing.title')}
			hint={translate(lang, 'settings.section.proHint')}
			href="/auth/pro"
		/>
	{/if}
	{#if showCoach && signedIn}
		<ProfileSettingsRow
			icon={UsersThree}
			label={translate(lang, 'profile.clients')}
			hint={translate(lang, 'settings.section.coachHint')}
			href="/auth/coach"
		/>
	{/if}
	<ProfileSettingsRow
		icon={CloudArrowDown}
		label={translate(lang, 'settings.exportTitle')}
		hint={translate(lang, 'settings.section.dataHint')}
		href="/auth/data"
	/>
	{#if signedIn}
		<ProfileSettingsRow
			icon={ShieldCheck}
			label={translate(lang, 'settings.accountTitle')}
			hint={translate(lang, 'settings.section.accountHint')}
			href="/auth/account"
		/>
	{:else}
		<ProfileSettingsRow
			icon={BookOpen}
			label={translate(lang, 'settings.section.help')}
			hint={translate(lang, 'settings.section.helpHint')}
			href="/articles"
		/>
		<ProfileSettingsRow
			icon={ShieldCheck}
			label={translate(lang, 'privacy.link')}
			href="/privacy"
		/>
	{/if}
</div>
