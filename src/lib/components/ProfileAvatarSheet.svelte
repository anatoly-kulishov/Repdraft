<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ImagePlus, Trash2 } from '@lucide/svelte';

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
		<div class="bottom-sheet__head profile-avatar-sheet__head">
			<p id={titleId} class="bottom-sheet__title profile-avatar-sheet__title">
				{translate(lang, 'auth.avatar.sheetTitle')}
			</p>
		</div>
		<div class="profile-avatar-sheet__actions" role="group" aria-labelledby={titleId}>
			<ProfileSettingsRow
				icon={ImagePlus}
				iconTone="accent"
				label={translate(lang, 'auth.avatar.change')}
				busy={busy}
				disabled={busy}
				onclick={changePhoto}
			/>
			{#if canRemove}
				<div class="profile-avatar-sheet__danger">
					<ProfileSettingsRow
						icon={Trash2}
						label={translate(lang, 'auth.avatar.remove')}
						busy={busy}
						disabled={busy}
						onclick={removePhoto}
					/>
				</div>
			{/if}
		</div>
	</BottomSheet>
{/if}
