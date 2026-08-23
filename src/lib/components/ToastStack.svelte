<script lang="ts">
	import AppIconButton from '$lib/components/AppIconButton.svelte';
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
				class="toast-item pointer-events-auto relative flex min-h-10 w-full flex-col gap-1 rounded-2xl px-3.5 py-2.5 pr-10 text-sm font-medium leading-snug"
				class:toast-item--accent={toast.kind === 'success' || toast.kind === 'info'}
				class:toast-item--error={toast.kind === 'error'}
				role="status"
			>
				<span class="max-w-full text-left">{toast.message}</span>
				{#if toast.action}
					<a class="toast-action" href={toast.action.href} onclick={() => toasts.dismiss(toast.id)}>
						{toast.action.label}
					</a>
				{/if}
				<AppIconButton
					class="toast-item__close absolute right-1.5 top-1/2 !min-h-0 !min-w-0 size-7 -translate-y-1/2 p-0"
					onclick={() => toasts.dismiss(toast.id)}
					aria-label={translate(lang, 'a11y.close')}
				>
					<LucideIcon icon={X} size={ICON_SMALL} />
				</AppIconButton>
			</div>
		{/each}
	</div>
{/if}

<style>
	.toast-item--accent {
		background: var(--color-accent);
		color: var(--color-accent-ink);
	}

	.toast-item--error {
		background: var(--color-danger);
		color: #fcfcfc;
	}

	.toast-item--accent :global(.toast-item__close) {
		color: color-mix(in srgb, var(--color-accent-ink) 72%, transparent);
	}

	.toast-item--accent :global(.toast-item__close:hover) {
		background: color-mix(in srgb, var(--color-accent-ink) 10%, transparent);
		color: var(--color-accent-ink);
	}

	.toast-item--error :global(.toast-item__close) {
		color: rgb(252 252 252 / 0.8);
	}

	.toast-item--error :global(.toast-item__close:hover) {
		background: rgb(252 252 252 / 0.15);
		color: #fcfcfc;
	}

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

	/* Mobile: single bottom CTA — toast sits above sticky bar (exercise, preview, builder…). */
	@media (max-width: 1023px) {
		:global(body:has(.sticky-actions):not(:has(.live-sticky-actions))) .toast-stack {
			top: auto;
			bottom: calc(var(--mobile-chrome-bottom) + var(--sticky-actions-h) + 0.65rem);
			flex-direction: column-reverse;
		}

		:global(body:has(.sticky-actions):not(:has(.live-sticky-actions)):has(.draft-dock)) .toast-stack {
			bottom: calc(
				var(--mobile-chrome-bottom) + var(--sticky-actions-h) + var(--draft-dock-clearance)
			);
		}

		/* Live workout: bottom is inputs + CTA — keep toast under header. */
		:global(body:has(.live-sticky-actions)) .toast-stack {
			top: calc(max(0.65rem, var(--safe-top)) + var(--toast-top-chrome, 0px));
			bottom: auto;
			flex-direction: column;
		}

		:global(body:has(.screen-header):has(.live-sticky-actions)) .toast-stack {
			top: calc(var(--screen-header-chrome-h) + 0.45rem);
		}

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
