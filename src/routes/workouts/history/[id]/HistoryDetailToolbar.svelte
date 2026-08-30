<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Check, ClipboardCopy, Pencil, Trash2, X } from '@lucide/svelte';

	let {
		editing = false,
		savingEdit = false,
		deleting = false,
		loading = false,
		canEdit = false,
		sendingToBuilder = false,
		saveDisabled = false,
		onSave,
		onCancel,
		onEdit,
		onDelete,
		onToBuilder
	}: {
		editing?: boolean;
		savingEdit?: boolean;
		deleting?: boolean;
		loading?: boolean;
		canEdit?: boolean;
		sendingToBuilder?: boolean;
		saveDisabled?: boolean;
		onSave: () => void | Promise<void>;
		onCancel: () => void;
		onEdit: () => void;
		onDelete: () => void | Promise<void>;
		onToBuilder: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
</script>

{#if editing}
	<AppButton
		variant="ghost"
		class="history-detail__icon-btn"
		disabled={savingEdit || deleting}
		aria-label={translate(lang, 'workouts.cancelEdit')}
		title={translate(lang, 'workouts.cancelEdit')}
		onclick={onCancel}
	>
		<LucideIcon icon={X} size={ICON_BUTTON} />
	</AppButton>
	<AppButton
		variant="ghost"
		class="history-detail__icon-btn history-detail__icon-btn--save"
		disabled={savingEdit || deleting || saveDisabled}
		aria-busy={savingEdit}
		aria-label={translate(lang, 'workouts.saveEdit')}
		title={translate(lang, 'workouts.saveEdit')}
		onclick={() => void onSave()}
	>
		{#if savingEdit}
			<Spinner size="sm" block={false} />
		{:else}
			<LucideIcon icon={Check} size={ICON_BUTTON} />
		{/if}
	</AppButton>
{:else}
	<AppButton
		variant="ghost"
		class="history-detail__icon-btn"
		disabled={deleting || loading || !canEdit}
		aria-label={translate(lang, 'workouts.editSession')}
		title={translate(lang, 'workouts.editSession')}
		onclick={onEdit}
	>
		<LucideIcon icon={Pencil} size={ICON_BUTTON} />
	</AppButton>
	<AppButton
		variant="ghost"
		class="history-detail__icon-btn"
		disabled={deleting || loading || !canEdit || sendingToBuilder}
		aria-busy={sendingToBuilder}
		aria-label={translate(lang, 'workouts.toBuilder')}
		title={translate(lang, 'workouts.toBuilder')}
		onclick={onToBuilder}
	>
		{#if sendingToBuilder}
			<Spinner size="sm" block={false} />
		{:else}
			<LucideIcon icon={ClipboardCopy} size={ICON_BUTTON} />
		{/if}
	</AppButton>
	<AppButton
		variant="ghost"
		class="is-danger history-detail__icon-btn"
		disabled={deleting || sendingToBuilder}
		aria-busy={deleting}
		aria-label={translate(lang, 'workouts.deleteSession')}
		title={translate(lang, 'workouts.deleteSession')}
		onclick={() => void onDelete()}
	>
		{#if deleting}
			<Spinner size="sm" block={false} />
		{:else}
			<LucideIcon icon={Trash2} size={ICON_BUTTON} />
		{/if}
	</AppButton>
{/if}
