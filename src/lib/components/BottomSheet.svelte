<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = false,
		titleId,
		labelledBy = null,
		label = null,
		dismissible = true,
		onDismiss,
		children,
		actions = null
	}: {
		open?: boolean;
		/** Prefer stable id pointing at the title inside the card. */
		titleId?: string;
		labelledBy?: string | null;
		/** Fallback when there is no visible title id. */
		label?: string | null;
		dismissible?: boolean;
		onDismiss?: () => void;
		children: Snippet;
		actions?: Snippet | null;
	} = $props();

	function dismiss() {
		if (!dismissible) return;
		onDismiss?.();
	}

	function onBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) dismiss();
	}

	function onKeydown(e: KeyboardEvent) {
		if (!open || !dismissible) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			dismiss();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="bottom-sheet"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		aria-labelledby={labelledBy ?? titleId ?? undefined}
		aria-label={labelledBy || titleId ? undefined : (label ?? undefined)}
		onclick={onBackdropClick}
	>
		<div class="bottom-sheet__card panel">
			{@render children()}
			{#if actions}
				<div class="bottom-sheet__actions">
					{@render actions()}
				</div>
			{/if}
		</div>
	</div>
{/if}
