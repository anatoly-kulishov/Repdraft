<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { toasts, type Toast } from '$lib/stores/toasts';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { X } from '@lucide/svelte';

	let { items }: { items: Toast[] } = $props();
	let lang = $derived($resolvedLocale);
</script>

{#if items.length}
	<div class="toast-stack pointer-events-none fixed z-[60] flex flex-col gap-2" aria-live="polite">
		{#each items as toast (toast.id)}
			<div
				class="pointer-events-auto relative flex min-h-10 w-full items-center rounded-2xl px-4 py-2.5 pr-10 text-sm font-medium leading-snug text-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] animate-[fadeIn_200ms_ease]"
				class:bg-[var(--color-accent)]={toast.kind === 'success' || toast.kind === 'info'}
				class:bg-[var(--color-danger)]={toast.kind === 'error'}
				role="status"
			>
				<span class="max-w-full text-left">{toast.message}</span>
				<button
					type="button"
					class="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
					onclick={() => toasts.dismiss(toast.id)}
					aria-label={translate(lang, 'a11y.close')}
				>
					<LucideIcon icon={X} size={ICON_SMALL} />
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	/* Above tab bar; sticky CTA offset only when that bar is in the tree (see :has). */
	.toast-stack {
		left: 50%;
		bottom: calc(var(--mobile-chrome-bottom) + 0.75rem);
		width: min(22rem, calc(100vw - 2rem));
		transform: translateX(-50%);
	}

	:global(body:has(.sticky-actions)) .toast-stack {
		bottom: calc(var(--mobile-chrome-bottom) + var(--sticky-actions-h) + 0.75rem);
	}

	/* Desktop chrome (matches .shell-nav-*): bottom-right, sticky/tabbar hidden */
	@media (min-width: 768px) and (min-height: 560px) {
		.toast-stack,
		:global(body:has(.sticky-actions)) .toast-stack {
			left: auto;
			right: 1.25rem;
			bottom: 1.5rem;
			width: min(22rem, calc(100vw - 2.5rem));
			transform: none;
		}
	}
</style>
