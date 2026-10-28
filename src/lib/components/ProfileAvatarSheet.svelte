<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Image as ImageIcon, Trash } from 'phosphor-svelte';

	let {
		open = false,
		canRemove = false,
		busy = false,
		onChangePhoto,
		onRemovePhoto,
		onDismiss
	}: {
		open?: boolean;
		canRemove?: boolean;
		busy?: boolean;
		onChangePhoto: () => void;
		onRemovePhoto: () => void;
		onDismiss: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let titleId = 'profile-avatar-sheet-title';

	function changePhoto() {
		if (busy) return;
		onChangePhoto();
		onDismiss();
	}

	function removePhoto() {
		if (busy) return;
		onDismiss();
		onRemovePhoto();
	}
</script>

{#if open}
	<BottomSheet {open} raised {titleId} onDismiss={onDismiss}>
		<span class="profile-avatar-sheet__grabber" aria-hidden="true"></span>
		<p id={titleId} class="bottom-sheet__title profile-avatar-sheet__title">
			{translate(lang, 'auth.avatar.sheetTitle')}
		</p>
		<div class="profile-avatar-sheet__list" role="group" aria-labelledby={titleId}>
			<ProfileSettingsRow
				icon={ImageIcon}
				iconTone="accent"
				label={translate(lang, 'auth.avatar.change')}
				disabled={busy}
				onclick={changePhoto}
			/>
			{#if canRemove}
				<ProfileSettingsRow
					icon={Trash}
					danger
					label={translate(lang, 'auth.avatar.remove')}
					disabled={busy}
					onclick={removePhoto}
				/>
			{/if}
		</div>
		{#snippet actions()}
			<AppButton variant="secondary" block disabled={busy} onclick={onDismiss}>
				{translate(lang, 'common.cancel')}
			</AppButton>
		{/snippet}
	</BottomSheet>
{/if}
