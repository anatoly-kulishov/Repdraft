<script lang="ts">
	import HomeKitSheet from '$lib/components/HomeKitSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY } from '$lib/components/icons/sizes';
	import IntakeStepper from '$lib/components/onboarding/IntakeStepper.svelte';
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { athleteProfile, homeKitSelection } from '$lib/stores/prefs';
	import { Barbell, ClipboardText, House, PencilSimple as Pencil } from 'phosphor-svelte';

	let lang = $derived($resolvedLocale);
	let homeKitSheetOpen = $state(false);
	let intakeEditOpen = $state(false);

	let placeSummary = $derived(
		translate(lang, $athleteProfile.trainingPlace === 'home' ? 'place.home' : 'place.gym')
	);
	let homeKitSummary = $derived.by(() => {
		const selected = $homeKitSelection;
		if (selected.length === 0) return translate(lang, 'homeKit.empty');
		return selected.map((id) => translate(lang, `homeKit.group.${id}`)).join(', ');
	});
	let intakeSummary = $derived(
		$athleteProfile.intakeCompletedAt
			? translate(lang, 'intake.profileDone')
			: translate(lang, 'intake.profileEmpty')
	);
</script>

<div class="profile-settings-group panel">
	<p class="profile-settings-group__title">{translate(lang, 'settings.trainingProfileTitle')}</p>
	<ProfileSettingsRow
		icon={House}
		label={translate(lang, 'place.row')}
		hint={placeSummary}
		onclick={() => {
			const next = $athleteProfile.trainingPlace === 'home' ? 'gym' : 'home';
			athleteProfile.patch({ trainingPlace: next });
		}}
	/>
	{#if $athleteProfile.trainingPlace === 'home'}
		<ProfileSettingsRow
			icon={Barbell}
			label={translate(lang, 'homeKit.row')}
			hint={homeKitSummary}
			onclick={() => (homeKitSheetOpen = true)}
		/>
	{/if}
	<ProfileSettingsRow
		icon={ClipboardText}
		label={translate(lang, 'intake.profileRow')}
		hint={intakeSummary}
		ariaLabel={translate(lang, 'intake.profileEdit')}
		onclick={() => (intakeEditOpen = true)}
	>
		<span class="profile-settings-row__value" aria-hidden="true">
			<LucideIcon icon={Pencil} size={ICON_PRIMARY} />
		</span>
	</ProfileSettingsRow>
	<p class="profile-settings-group__hint">{translate(lang, 'place.hint')}</p>
</div>

<HomeKitSheet bind:open={homeKitSheetOpen} />
<IntakeStepper bind:open={intakeEditOpen} mode="edit" />
