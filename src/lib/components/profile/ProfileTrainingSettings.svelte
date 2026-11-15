<script lang="ts">
	import HomeKitSheet from '$lib/components/HomeKitSheet.svelte';
	import IntakeStepper from '$lib/components/onboarding/IntakeStepper.svelte';
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import ProfileSettingsSection from '$lib/components/profile/ProfileSettingsSection.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { formatHomeKitSummary } from '$lib/domain/homeKit';
	import { athleteProfile, homeKitSelection } from '$lib/stores/prefs';
	import { Barbell, ClipboardText, House } from 'phosphor-svelte';

	let lang = $derived($resolvedLocale);
	let homeKitSheetOpen = $state(false);
	let intakeEditOpen = $state(false);

	let placeSummary = $derived(
		translate(lang, $athleteProfile.trainingPlace === 'home' ? 'place.home' : 'place.gym')
	);
	let homeKitSummary = $derived(
		formatHomeKitSummary(
			$homeKitSelection,
			(id) => translate(lang, `homeKit.group.${id}`),
			translate(lang, 'homeKit.empty')
		)
	);
	let intakeSummary = $derived(
		$athleteProfile.intakeCompletedAt
			? translate(lang, 'intake.profileDone')
			: translate(lang, 'intake.profileEmpty')
	);
</script>

<ProfileSettingsSection hint={translate(lang, 'place.hint')}>
	<ProfileSettingsRow
		icon={House}
		label={translate(lang, 'place.row')}
		value={placeSummary}
		onclick={() => {
			const next = $athleteProfile.trainingPlace === 'home' ? 'gym' : 'home';
			athleteProfile.patch({ trainingPlace: next });
		}}
	/>
	{#if $athleteProfile.trainingPlace === 'home'}
		<ProfileSettingsRow
			icon={Barbell}
			label={translate(lang, 'homeKit.row')}
			value={homeKitSummary}
			onclick={() => (homeKitSheetOpen = true)}
		/>
	{/if}
	<ProfileSettingsRow
		icon={ClipboardText}
		label={translate(lang, 'intake.profileRow')}
		value={intakeSummary}
		ariaLabel={translate(lang, 'intake.profileEdit')}
		onclick={() => (intakeEditOpen = true)}
	/>
</ProfileSettingsSection>

<HomeKitSheet bind:open={homeKitSheetOpen} />
<IntakeStepper bind:open={intakeEditOpen} mode="edit" />
