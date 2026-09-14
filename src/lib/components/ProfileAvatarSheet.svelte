<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

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
		<div class="bottom-sheet__head">
			<p id={titleId} class="bottom-sheet__title">
				{translate(lang, 'auth.avatar.sheetTitle')}
			</p>
		</div>
		<div class="profile-avatar-sheet__actions">
			<AppButton variant="primary" block disabled={busy} onclick={changePhoto}>
				{translate(lang, 'auth.avatar.change')}
			</AppButton>
			{#if canRemove}
				<AppButton variant="danger" block disabled={busy} onclick={removePhoto}>
					{translate(lang, 'auth.avatar.remove')}
				</AppButton>
			{/if}
		</div>
	</BottomSheet>
{/if}
