<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { toasts, UNDO_MS, type Toast } from '$lib/stores/toasts';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { X } from '@lucide/svelte';

	let { items }: { items: Toast[] } = $props();
	let lang = $derived($resolvedLocale);

	type UndoTick = { secondsLeft: number; progress: number };

	let undoTicks = $state<Record<number, UndoTick>>({});

	$effect(() => {
		const undoItems = items.filter(
			(t): t is Toast & { onUndo: NonNullable<Toast['onUndo']>; undoExpiresAt: number } =>
				Boolean(t.onUndo && t.undoExpiresAt)
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
		const id = window.setInterval(tick, 100);
		return () => window.clearInterval(id);
	});

	function undoAriaLabel(toast: Toast): string {
		const seconds = undoTicks[toast.id]?.secondsLeft ?? 0;
		return translate(lang, 'toast.undoSeconds', { seconds: String(seconds) });
	}
</script>

{#if items.length}
	<div class="toast-stack pointer-events-none fixed z-[60] flex flex-col-reverse gap-2" aria-live="polite">
		{#each items as toast (toast.id)}
			<div
				class="toast-item pointer-events-auto flex min-h-12 w-full items-start gap-1 rounded-2xl py-2 pl-3.5 pr-1.5 text-sm font-medium leading-snug"
				class:toast-item--accent={toast.kind === 'success' || toast.kind === 'info'}
				class:toast-item--error={toast.kind === 'error'}
				role="status"
			>
				<div class="toast-item__body min-w-0 flex-1 py-0.5">
					<span class="block max-w-full text-left">{toast.message}</span>
					{#if toast.onUndo}
						{@const tick = undoTicks[toast.id]}
						<button
							type="button"
							class="toast-undo"
							aria-label={undoAriaLabel(toast)}
							onclick={() => toasts.undo(toast.id, toast.onUndo!)}
						>
							<span
								class="toast-undo__ring"
								style={`--toast-undo-progress: ${tick?.progress ?? 1}`}
								aria-hidden="true"
							>
								<span class="toast-undo__seconds">{tick?.secondsLeft ?? '…'}</span>
							</span>
							<span class="toast-undo__label">{translate(lang, 'common.undo')}</span>
						</button>
					{:else if toast.action}
						<a class="toast-action" href={toast.action.href} onclick={() => toasts.dismiss(toast.id)}>
							{toast.action.label}
						</a>
					{/if}
				</div>
				<button
					type="button"
					class="toast-item__close shrink-0"
					onclick={() => toasts.dismiss(toast.id)}
					aria-label={translate(lang, 'a11y.close')}
				>
					<LucideIcon icon={X} size={ICON_BUTTON} />
				</button>
			</div>
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

	.toast-item--error {
		background: var(--color-danger);
		color: #fcfcfc;
	}

	.toast-item--accent .toast-item__close {
		color: var(--color-muted);
	}

	.toast-item__close {
		position: relative;
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		min-width: 3rem;
		min-height: 3rem;
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

	.toast-undo {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.15rem;
		padding: 0.15rem 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 700;
		cursor: pointer;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.toast-undo:hover {
		opacity: 0.92;
	}

	.toast-undo__ring {
		--p: var(--toast-undo-progress, 1);
		position: relative;
		display: grid;
		place-items: center;
		width: 1.65rem;
		height: 1.65rem;
		border-radius: 999px;
		background: conic-gradient(
			var(--color-accent) calc(var(--p) * 360deg),
			color-mix(in srgb, var(--color-muted) 35%, var(--color-surface-muted)) 0
		);
	}

	.toast-undo__ring::after {
		content: '';
		position: absolute;
		inset: 0.2rem;
		border-radius: inherit;
		background: var(--color-surface);
	}

	.toast-item--error .toast-undo__ring::after {
		background: var(--color-danger);
	}

	.toast-undo__seconds {
		position: relative;
		z-index: 1;
		font-size: 0.6875rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		color: var(--color-accent-text);
	}

	.toast-item--error .toast-undo__seconds {
		color: #fcfcfc;
	}

	.toast-undo__label {
		text-decoration: underline;
		text-underline-offset: 0.12em;
	}

	/* Sit just above tabbar — default mobile. Enter: kineticsToastIn in layout.css */
	.toast-stack {
		left: 50%;
		bottom: calc(var(--mobile-chrome-bottom) + 0.65rem + var(--vv-fixed-bottom, 0px));
		width: min(20.5rem, calc(100vw - 2rem));
		transform: translateX(-50%);
	}

	/* Keep dismiss clear of bottom-right FAB (+). */
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
