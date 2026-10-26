<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	type Props = {
		open: boolean;
		titleId: string;
		title: string;
		hint?: string;
		confirmLabel: string;
		cancelLabel?: string;
		variant?: 'primary' | 'danger';
		busy?: boolean;
		onConfirm: () => void;
		onDismiss: () => void;
	};

	let {
		open,
		titleId,
		title,
		hint,
		confirmLabel,
		cancelLabel,
		variant = 'danger',
		busy = false,
		onConfirm,
		onDismiss
	}: Props = $props();

	let lang = $derived($resolvedLocale);
</script>

<BottomSheet {open} {titleId} {onDismiss} dismissible={!busy}>
	<p id={titleId} class="bottom-sheet__title">{title}</p>
	{#if hint}
		<p class="bottom-sheet__hint">{hint}</p>
	{/if}
	{#snippet actions()}
		<AppButton variant="secondary" onclick={onDismiss} disabled={busy}>
			{cancelLabel ?? translate(lang, 'common.cancel')}
		</AppButton>
		<AppButton {variant} onclick={onConfirm} disabled={busy} aria-busy={busy || undefined}>
			{#if busy}
				<span class="inline-flex items-center gap-2">
					<Spinner size="sm" block={false} />
					{confirmLabel}
				</span>
			{:else}
				{confirmLabel}
			{/if}
		</AppButton>
	{/snippet}
</BottomSheet>
