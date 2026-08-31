<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { syncToastStackLift, watchToastStackLift } from '$lib/dom/toastStackLift';
	import { toasts, UNDO_MS, type Toast } from '$lib/stores/toasts';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import Spinner from '$lib/components/Spinner.svelte';
	import { X } from '@lucide/svelte';

	let { items }: { items: Toast[] } = $props();
	let lang = $derived($resolvedLocale);

	type UndoTick = { secondsLeft: number; progress: number };

	let undoTicks = $state<Record<number, UndoTick>>({});

	const UNDO_RING_R = 14;
	const UNDO_RING_C = 2 * Math.PI * UNDO_RING_R;

	$effect(() => {
		const undoItems = items.filter(
			(t): t is Toast & { onUndo: NonNullable<Toast['onUndo']>; undoExpiresAt: number } =>
				Boolean(t.onUndo && t.undoExpiresAt && !t.undoBusy)
		);
		if (undoItems.length === 0) {
			undoTicks = {};
			return;
		}

		const tick = () => {
			const next: Record<number, UndoTick> = {};
			for (const toast of undoItems) {
				const duration = toast.undoDurationMs ?? UNDO_MS;
				const remaining = Math.max(0, toast.undoExpiresAt - Date.now());
				next[toast.id] = {
					secondsLeft: Math.max(0, Math.ceil(remaining / 1000)),
					progress: duration > 0 ? remaining / duration : 0
				};
			}
			undoTicks = next;
		};

		tick();
		const id = window.setInterval(tick, 50);
		return () => window.clearInterval(id);
	});

	function undoAriaLabel(toast: Toast): string {
		const seconds = undoTicks[toast.id]?.secondsLeft ?? 0;
		return translate(lang, 'toast.undoSeconds', { seconds: String(seconds) });
	}

	function undoRingOffset(progress: number): number {
		return UNDO_RING_C * (1 - progress);
	}

	const hasUndoSnackbar = $derived(items.some((t) => Boolean(t.onUndo)));

	$effect(() => watchToastStackLift());

	$effect(() => {
		items;
		syncToastStackLift();
	});
</script>

{#if items.length}
	<div
		class="toast-stack pointer-events-none fixed z-[60] flex flex-col-reverse gap-2"
		class:toast-stack--undo-snackbar={hasUndoSnackbar}
		aria-live="polite"
	>
		{#each items as toast (toast.id)}
			{#if toast.onUndo}
				<div
					class="toast-item toast-item--undo-snackbar pointer-events-auto"
					role="status"
					aria-live="polite"
				>
					{#if toast.undoBusy}
						<div class="toast-undo-snackbar__ring toast-undo-snackbar__ring--busy" aria-hidden="true">
							<Spinner size="sm" block={false} label="" />
						</div>
						<span class="toast-undo-snackbar__message">{toast.message}</span>
						<span class="toast-undo-snackbar__action toast-undo-snackbar__action--busy">
							{translate(lang, 'toast.undoBusy')}
						</span>
					{:else}
						{@const tick = undoTicks[toast.id]}
						<div class="toast-undo-snackbar__ring" aria-hidden="true">
							<svg
								class="toast-undo-snackbar__svg"
								viewBox="0 0 36 36"
								width="36"
								height="36"
								aria-hidden="true"
							>
								<circle
									class="toast-undo-snackbar__track"
									cx="18"
									cy="18"
									r={UNDO_RING_R}
									fill="none"
									stroke-width="2"
								/>
								<circle
									class="toast-undo-snackbar__arc"
									cx="18"
									cy="18"
									r={UNDO_RING_R}
									fill="none"
									stroke-width="2"
									stroke-linecap="round"
									transform="rotate(-90 18 18)"
									stroke-dasharray={UNDO_RING_C}
									stroke-dashoffset={undoRingOffset(tick?.progress ?? 1)}
								/>
							</svg>
							<span class="toast-undo-snackbar__seconds">{tick?.secondsLeft ?? '…'}</span>
						</div>
						<span class="toast-undo-snackbar__message">{toast.message}</span>
						<button
							type="button"
							class="toast-undo-snackbar__action"
							aria-label={undoAriaLabel(toast)}
							onclick={() => toasts.undo(toast.id, toast.onUndo!)}
						>
							{translate(lang, 'common.undo')}
						</button>
					{/if}
				</div>
			{:else}
				<div
					class="toast-item pointer-events-auto relative w-full rounded-2xl py-2 pl-3.5 pr-11 text-sm font-medium leading-snug"
					class:toast-item--accent={toast.kind === 'success' || toast.kind === 'info'}
					class:toast-item--error={toast.kind === 'error'}
					role="status"
				>
					<div class="toast-item__body min-w-0">
						<span class="block max-w-full text-left">{toast.message}</span>
						{#if toast.action}
							<a class="toast-action" href={toast.action.href} onclick={() => toasts.dismiss(toast.id)}>
								{toast.action.label}
							</a>
						{/if}
					</div>
					<button
						type="button"
						class="toast-item__close"
						onclick={() => toasts.dismiss(toast.id)}
						aria-label={translate(lang, 'a11y.close')}
					>
						<LucideIcon icon={X} size={ICON_BUTTON} />
					</button>
				</div>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.toast-item--accent {
		background: var(--color-surface);
		color: var(--color-ink);
		border: 1px solid var(--color-border);
		box-shadow: var(--shadow-float);
	}

	.toast-item {
		flex: 0 0 auto;
		align-self: stretch;
		min-height: 2.5rem;
	}

	.toast-item--error {
		background: var(--color-danger);
		color: #fcfcfc;
	}

	.toast-item--accent .toast-item__close {
		color: var(--color-muted);
	}

	.toast-item__close {
		position: absolute;
		top: 50%;
		right: 0.125rem;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		min-width: 2.75rem;
		min-height: 2.75rem;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: inherit;
		line-height: 0;
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		appearance: none;
	}

	.toast-item__close::before {
		content: '';
		position: absolute;
		inset: -0.35rem;
	}

	.toast-item--accent .toast-item__close:hover,
	.toast-item--accent .toast-item__close:active {
		background: var(--color-surface-muted);
		color: var(--color-ink);
	}

	.toast-item--error .toast-item__close {
		color: rgb(252 252 252 / 0.85);
	}

	.toast-item--error .toast-item__close:hover,
	.toast-item--error .toast-item__close:active {
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
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		font: inherit;
	}

	.toast-action:hover {
		opacity: 1;
	}

	/* Telegram-style undo snackbar */
	.toast-item--undo-snackbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		min-height: 3rem;
		padding: 0.75rem 1.15rem;
		border: 1px solid var(--toast-snackbar-border);
		border-radius: 9999px;
		background: var(--toast-snackbar-bg);
		color: var(--toast-snackbar-fg);
		box-shadow: var(--toast-snackbar-shadow);
		backdrop-filter: blur(20px) saturate(1.2);
		-webkit-backdrop-filter: blur(20px) saturate(1.2);
		font-size: 0.9375rem;
		font-weight: 400;
		line-height: 1.25;
		animation: kineticsSnackbarIn 0.28s var(--ease-snackbar) both;
		transform-origin: center bottom;
	}

	.toast-undo-snackbar__ring {
		position: relative;
		flex: 0 0 auto;
		width: 2.25rem;
		height: 2.25rem;
	}

	.toast-undo-snackbar__ring--busy {
		display: grid;
		place-items: center;
	}

	.toast-undo-snackbar__ring--busy :global(.loader-inline) {
		gap: 0;
	}

	.toast-undo-snackbar__ring--busy :global(.loader-spinner) {
		width: 1.35rem;
		height: 1.35rem;
		border-width: 2px;
		border-color: var(--toast-snackbar-spinner-track);
		border-top-color: var(--toast-snackbar-ring);
	}

	.toast-undo-snackbar__svg {
		display: block;
		width: 100%;
		height: 100%;
	}

	.toast-undo-snackbar__track {
		stroke: var(--toast-snackbar-ring-track);
	}

	.toast-undo-snackbar__arc {
		stroke: var(--toast-snackbar-ring);
		transition: stroke-dashoffset 80ms linear;
	}

	.toast-undo-snackbar__seconds {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 0.8125rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		color: var(--toast-snackbar-fg);
	}

	.toast-undo-snackbar__message {
		flex: 1 1 auto;
		min-width: 0;
		text-align: left;
		color: var(--toast-snackbar-fg);
	}

	.toast-undo-snackbar__action {
		flex: 0 0 auto;
		margin: 0;
		padding: 0.35rem 0;
		border: 0;
		background: transparent;
		color: var(--toast-snackbar-action);
		font: inherit;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.25;
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		white-space: nowrap;
	}

	.toast-undo-snackbar__action:hover,
	.toast-undo-snackbar__action:active {
		color: var(--toast-snackbar-action-hover);
	}

	.toast-undo-snackbar__action--busy {
		color: color-mix(in srgb, var(--toast-snackbar-fg) 72%, transparent);
		cursor: default;
		pointer-events: none;
		font-weight: 500;
		font-size: 0.875rem;
	}

	.toast-stack {
		top: auto;
		height: auto;
		left: 50%;
		--toast-stack-bottom-base: calc(
			var(--mobile-chrome-bottom) + 0.65rem + var(--vv-fixed-bottom, 0px)
		);
		bottom: max(var(--toast-stack-bottom-base), var(--toast-stack-lift, 0px));
		width: min(20.5rem, calc(100vw - 2rem));
		transform: translateX(-50%);
	}

	.toast-stack--undo-snackbar {
		width: calc(100vw - 2rem);
		max-width: 28rem;
	}

	@media (max-width: 1023px) {
		:global(
				body:has(.workouts-fab:not(.workouts-fab--hidden)):not(:has(.sticky-actions)):not(
						:has(.live-sticky-actions)
					)
			)
			.toast-stack,
		:global(
				body:has(.app-fab:not(.app-fab--hidden)):not(:has(.sticky-actions)):not(:has(.live-sticky-actions))
			)
			.toast-stack {
			left: max(1rem, var(--safe-left));
			right: calc(var(--fab-size) + 1.15rem + var(--safe-right));
			width: auto;
			transform: none;
		}

		:global(
				body:has(.workouts-fab:not(.workouts-fab--hidden)):not(:has(.sticky-actions)):not(
						:has(.live-sticky-actions)
					)
			)
			.toast-stack--undo-snackbar,
		:global(
				body:has(.app-fab:not(.app-fab--hidden)):not(:has(.sticky-actions)):not(:has(.live-sticky-actions))
			)
			.toast-stack--undo-snackbar {
			right: max(1rem, var(--safe-right));
		}
	}

	:global(body:has(.draft-dock)) .toast-stack {
		--toast-stack-bottom-base: calc(var(--mobile-chrome-bottom) + var(--draft-dock-clearance));
	}

	@media (max-width: 1023px) {
		:global(body:has(.sticky-actions):not(:has(.live-sticky-actions))) .toast-stack {
			top: auto;
			--toast-stack-bottom-base: calc(var(--mobile-chrome-bottom) + var(--sticky-actions-h) + 0.65rem);
			bottom: max(var(--toast-stack-bottom-base), var(--toast-stack-lift, 0px));
			flex-direction: column-reverse;
		}

		:global(body:has(.sticky-actions):not(:has(.live-sticky-actions)):has(.draft-dock)) .toast-stack {
			--toast-stack-bottom-base: calc(
				var(--mobile-chrome-bottom) + var(--sticky-actions-h) + var(--draft-dock-clearance)
			);
		}

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

		:global(body:has(.live-sticky-actions)) .toast-stack--undo-snackbar {
			top: auto;
			--toast-stack-bottom-base: calc(var(--mobile-chrome-bottom) + var(--sticky-actions-h) + 0.65rem);
			bottom: max(var(--toast-stack-bottom-base), var(--toast-stack-lift, 0px));
			flex-direction: column-reverse;
		}
	}

	@media (min-width: 1024px) {
		:global(body:has(.sticky-actions)) .toast-stack {
			--toast-stack-bottom-base: calc(var(--mobile-chrome-bottom) + var(--sticky-actions-h) + 0.65rem);
		}

		:global(body:has(.live-sticky-actions)) .toast-stack {
			--toast-stack-bottom-base: calc(var(--safe-bottom) + var(--sticky-actions-h) + 0.75rem);
		}

		:global(body:has(.sticky-actions):has(.draft-dock)) .toast-stack {
			--toast-stack-bottom-base: calc(
				var(--mobile-chrome-bottom) + var(--sticky-actions-h) + var(--draft-dock-clearance)
			);
		}
	}

	@media (min-width: 1024px) and (min-height: 560px) {
		.toast-stack:not(.toast-stack--undo-snackbar),
		:global(body:has(.sticky-actions)) .toast-stack:not(.toast-stack--undo-snackbar),
		:global(body:has(.draft-dock)) .toast-stack:not(.toast-stack--undo-snackbar),
		:global(body:has(.live-sticky-actions)) .toast-stack:not(.toast-stack--undo-snackbar) {
			left: auto;
			right: 1.25rem;
			--toast-stack-bottom-base: 1.35rem;
			bottom: max(var(--toast-stack-bottom-base), var(--toast-stack-lift, 0px));
			top: auto;
			width: min(20.5rem, calc(100vw - 2.5rem));
			transform: none;
		}

		.toast-stack--undo-snackbar,
		:global(body:has(.sticky-actions)) .toast-stack--undo-snackbar,
		:global(body:has(.draft-dock)) .toast-stack--undo-snackbar,
		:global(body:has(.live-sticky-actions)) .toast-stack--undo-snackbar {
			left: 50%;
			right: auto;
			--toast-stack-bottom-base: 1.35rem;
			bottom: max(var(--toast-stack-bottom-base), var(--toast-stack-lift, 0px));
			top: auto;
			width: min(28rem, calc(100vw - 2.5rem));
			transform: translateX(-50%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.toast-undo-snackbar__arc {
			transition: none;
		}
	}
</style>
