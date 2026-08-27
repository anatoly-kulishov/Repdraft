<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { cn } from '$lib/utils.js';
	import type { Snippet } from 'svelte';

	let {
		open = false,
		titleId,
		labelledBy = null,
		label = null,
		dismissible = true,
		raised = false,
		onDismiss,
		children,
		actions = null
	}: {
		open?: boolean;
		titleId?: string;
		labelledBy?: string | null;
		label?: string | null;
		dismissible?: boolean;
		raised?: boolean;
		onDismiss?: () => void;
		children: Snippet;
		actions?: Snippet | null;
	} = $props();

	let lang = $derived($resolvedLocale);

	function onOpenChange(next: boolean) {
		if (!next && dismissible) onDismiss?.();
	}

	function dismissBackdrop() {
		if (!dismissible) return;
		onDismiss?.();
	}
</script>

<Sheet.Root {open} onOpenChange={onOpenChange}>
	<Sheet.Content
		side="bottom"
		showCloseButton={false}
		class={cn(
			'bottom-sheet gap-0 border-0 bg-transparent p-0 shadow-none',
			raised && 'bottom-sheet--raised'
		)}
		onInteractOutside={(e) => {
			if (!dismissible) e.preventDefault();
		}}
		onEscapeKeydown={(e) => {
			if (!dismissible) e.preventDefault();
		}}
		aria-labelledby={labelledBy ?? titleId ?? undefined}
		aria-label={labelledBy || titleId ? undefined : (label ?? undefined)}
	>
		<!-- Full-viewport hit target: dimmed area above the card closes the sheet. -->
		<div class="bottom-sheet__host">
			<button
				type="button"
				class="bottom-sheet__backdrop"
				aria-label={translate(lang, 'a11y.close')}
				tabindex="-1"
				onclick={dismissBackdrop}
			></button>
			<div
				class="bottom-sheet__card panel mx-auto w-full max-w-sm gap-0 border-0 shadow-[var(--shadow-overlay)]"
			>
				{@render children()}
				{#if actions}
					<div class="bottom-sheet__actions">
						{@render actions()}
					</div>
				{/if}
			</div>
		</div>
	</Sheet.Content>
</Sheet.Root>
