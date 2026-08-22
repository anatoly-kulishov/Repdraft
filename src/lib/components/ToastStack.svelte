<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { toasts, type Toast } from '$lib/stores/toasts';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { X } from '@lucide/svelte';

	let { items }: { items: Toast[] } = $props();
	let lang = $derived($resolvedLocale);
</script>

{#if items.length}
	<div class="toast-stack pointer-events-none fixed z-[60] flex flex-col-reverse gap-2" aria-live="polite">
		{#each items as toast (toast.id)}
			<div
				class="toast-item pointer-events-auto relative flex min-h-10 w-full flex-col gap-1 rounded-2xl px-3.5 py-2.5 pr-10 text-sm font-medium leading-snug text-white"
				class:bg-[var(--color-accent)]={toast.kind === 'success' || toast.kind === 'info'}
				class:bg-[var(--color-danger)]={toast.kind === 'error'}
				role="status"
			>
				<span class="max-w-full text-left">{toast.message}</span>
				{#if toast.action}
					<a class="toast-action" href={toast.action.href} onclick={() => toasts.dismiss(toast.id)}>
						{toast.action.label}
					</a>
				{/if}
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
	.toast-action {
		align-self: flex-start;
		font-size: 0.8125rem;
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 0.12em;
		color: inherit;
		opacity: 0.95;
	}

	.toast-action:hover {
		opacity: 1;
	}

	/* Sit just above tabbar — default mobile. Enter: kineticsToastIn in layout.css */
	.toast-stack {
		left: 50%;
		bottom: calc(var(--mobile-chrome-bottom) + 0.65rem);
		width: min(20.5rem, calc(100vw - 2rem));
		transform: translateX(-50%);
	}

	:global(body:has(.draft-dock)) .toast-stack {
		bottom: calc(var(--mobile-chrome-bottom) + var(--draft-dock-clearance));
	}

	/* Mobile + sticky CTA: top placement — never cover scroll fields / Save bar. */
	@media (max-width: 1023px) {
		:global(body:has(.sticky-actions)) .toast-stack,
		:global(body:has(.live-sticky-actions)) .toast-stack {
			top: calc(max(0.65rem, var(--safe-top)) + var(--toast-top-chrome, 0px));
			bottom: auto;
			flex-direction: column;
		}

		/* Sticky/fixed ScreenHeader (exercise detail, builder, preview…) — sit below chrome. */
		:global(body:has(.screen-header):has(.sticky-actions)) .toast-stack,
		:global(body:has(.screen-header):has(.live-sticky-actions)) .toast-stack {
			top: calc(var(--screen-header-chrome-h) + 0.45rem);
		}

		:global(body:has(.sticky-actions)) .toast-stack .toast-item,
		:global(body:has(.live-sticky-actions)) .toast-stack .toast-item {
			animation: kineticsToastInTop 0.55s var(--ease-toast) both;
		}
	}

	@media (min-width: 1024px) {
		:global(body:has(.sticky-actions)) .toast-stack {
			bottom: calc(var(--mobile-chrome-bottom) + var(--sticky-actions-h) + 0.65rem);
		}

		:global(body:has(.live-sticky-actions)) .toast-stack {
			bottom: calc(var(--safe-bottom) + var(--sticky-actions-h) + 0.75rem);
		}

		:global(body:has(.sticky-actions):has(.draft-dock)) .toast-stack {
			bottom: calc(
				var(--mobile-chrome-bottom) + var(--sticky-actions-h) + var(--draft-dock-clearance)
			);
		}
	}

	@media (min-width: 1024px) and (min-height: 560px) {
		.toast-stack,
		:global(body:has(.sticky-actions)) .toast-stack,
		:global(body:has(.draft-dock)) .toast-stack,
		:global(body:has(.live-sticky-actions)) .toast-stack {
			left: auto;
			right: 1.25rem;
			bottom: 1.35rem;
			top: auto;
			width: min(20.5rem, calc(100vw - 2.5rem));
			transform: none;
		}
	}

</style>
