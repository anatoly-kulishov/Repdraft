<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { syncToastStackLift, watchToastStackLift } from '$lib/dom/toastStackLift';
	import {
		toastSwipeDismiss,
		toastSwipeSkipResetMotion
	} from '$lib/dom/toastSwipeDismiss';
	import { toasts, UNDO_MS, type Toast } from '$lib/stores/toasts';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import Spinner from '$lib/components/Spinner.svelte';
	import { X, Check } from '@lucide/svelte';

	let { items }: { items: Toast[] } = $props();
	let lang = $derived($resolvedLocale);

	type UndoTick = { secondsLeft: number; progress: number };

	let undoTicks = $state<Record<number, UndoTick>>({});

	const UNDO_RING_R = 14;
	const UNDO_RING_C = 2 * Math.PI * UNDO_RING_R;

	let swipeId = $state<number | null>(null);
	let swipeDx = $state(0);
	let swipeOpacity = $state(1);
	let swipeDragging = $state(false);
	let swipeResetting = $state(false);
	let swipeResetTimer: number | undefined;

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

	function clearSwipeResetTimer() {
		if (swipeResetTimer !== undefined) {
			window.clearTimeout(swipeResetTimer);
			swipeResetTimer = undefined;
		}
	}

	function clearSwipeVisual() {
		clearSwipeResetTimer();
		swipeId = null;
		swipeDx = 0;
		swipeOpacity = 1;
		swipeDragging = false;
		swipeResetting = false;
	}

	function swipeStyle(toastId: number): string | undefined {
		if (swipeId !== toastId) return undefined;
		return `transform: translateX(${swipeDx}px); opacity: ${swipeOpacity};`;
	}

	function onSwipeDrag(toastId: number, dx: number, opacity: number) {
		clearSwipeResetTimer();
		swipeId = toastId;
		swipeDx = dx;
		swipeOpacity = opacity;
		swipeDragging = true;
		swipeResetting = false;
	}

	function onSwipeIdle(toastId: number, animateReset: boolean) {
		if (swipeId !== null && swipeId !== toastId) return;
		if (!animateReset || toastSwipeSkipResetMotion()) {
			clearSwipeVisual();
			return;
		}
		swipeDragging = false;
		swipeResetting = true;
		swipeDx = 0;
		swipeOpacity = 1;
		clearSwipeResetTimer();
		swipeResetTimer = window.setTimeout(() => {
			swipeResetTimer = undefined;
			if (swipeId === toastId) clearSwipeVisual();
		}, 200);
	}

	function swipeParams(toastId: number) {
		return {
			onDismiss: () => toasts.dismiss(toastId),
			onDrag: (dx: number, opacity: number) => onSwipeDrag(toastId, dx, opacity),
			onIdle: (animateReset: boolean) => onSwipeIdle(toastId, animateReset)
		};
	}

	$effect(() => {
		const activeId = items[0]?.id;
		if (swipeId !== null && activeId !== swipeId) clearSwipeVisual();
	});

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
					class:toast-item--swiping={swipeDragging && swipeId === toast.id}
					class:toast-item--swipe-reset={swipeResetting && swipeId === toast.id}
					role="status"
					aria-live="polite"
					style={swipeStyle(toast.id)}
					use:toastSwipeDismiss={swipeParams(toast.id)}
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
					class:toast-item--swiping={swipeDragging && swipeId === toast.id}
					class:toast-item--swipe-reset={swipeResetting && swipeId === toast.id}
					role="status"
					style={swipeStyle(toast.id)}
					use:toastSwipeDismiss={swipeParams(toast.id)}
				>
					<div class="toast-item__body min-w-0">
						<span class="toast-item__message">
							{#if toast.kind === 'success'}
								<span class="toast-item__icon" aria-hidden="true">
									<LucideIcon icon={Check} size={ICON_BUTTON} />
								</span>
							{/if}
							<span class="toast-item__text">{toast.message}</span>
						</span>
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
		min-width: 0;
		max-width: 100%;
		min-height: 2.5rem;
		overflow: hidden;
		touch-action: pan-y;
	}

	.toast-item__body {
		min-width: 0;
		max-width: 100%;
	}

	.toast-item--swiping {
		transition: none;
		animation: none !important;
		user-select: none;
	}

	.toast-item--swipe-reset {
		transition:
			transform 0.2s var(--ease-snackbar, ease),
			opacity 0.2s var(--ease-snackbar, ease);
		animation: none !important;
	}

	.toast-item--error {
		background: var(--color-danger);
		color: #fcfcfc;
	}

	.toast-item__message {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		min-width: 0;
		max-width: 100%;
	}

	/* Clipboard fallback toasts may show a raw URL with no spaces. */
	.toast-item__text {
		display: block;
		min-width: 0;
		max-width: 100%;
		text-align: left;
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.toast-item__icon {
		display: inline-flex;
		flex-shrink: 0;
		margin-top: 0.1rem;
		color: var(--color-accent-text-soft);
	}

	.toast-item--accent .toast-item__close {
		color: var(--color-muted);
	}

	.toast-item__close {
		position: absolute;
		top: 50%;
		right: 0.35rem;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		/* Visual size fits inside the toast; 48px hit via ::before. */
		width: 2rem;
		height: 2rem;
		min-width: 2rem;
		min-height: 2rem;
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
		/* 2rem + 0.5rem*2 = 3rem (48px) touch target */
		inset: -0.5rem;
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
		align-self: center;
		flex-shrink: 0;
		margin: 0;
		padding: 0.35rem 0;
		min-height: 2rem;
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 650;
		letter-spacing: -0.01em;
		color: var(--color-accent-text);
		text-decoration: none;
		cursor: pointer;
		white-space: nowrap;
	}

	.toast-action:hover {
		text-decoration: underline;
		text-underline-offset: 0.12em;
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
		/*
		 * With a bottom-right + FAB (and optional bottom-left scroll-to-top), do not
		 * squeeze the toast beside them. Sit centered above the FAB row instead.
		 * Undo snackbars use the same clearance so they never cover the FAB.
		 */
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
			left: 50%;
			right: auto;
			transform: translateX(-50%);
			--toast-stack-bottom-base: calc(
				var(--mobile-chrome-bottom) + var(--fab-above-tabbar) + var(--fab-size) + 0.65rem +
					var(--vv-fixed-bottom, 0px)
			);
		}

		:global(
				body:has(.workouts-fab:not(.workouts-fab--hidden)):not(:has(.sticky-actions)):not(
						:has(.live-sticky-actions)
					)
			)
			.toast-stack:not(.toast-stack--undo-snackbar),
		:global(
				body:has(.app-fab:not(.app-fab--hidden)):not(:has(.sticky-actions)):not(:has(.live-sticky-actions))
			)
			.toast-stack:not(.toast-stack--undo-snackbar) {
			width: min(20.5rem, calc(100vw - 2rem));
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
			width: calc(100vw - 2rem);
			max-width: 28rem;
		}
	}

	:global(body:has(.draft-dock)) .toast-stack:not(.toast-stack--undo-snackbar) {
		--toast-stack-bottom-base: calc(var(--mobile-chrome-bottom) + var(--draft-dock-clearance));
	}

	@media (max-width: 1023px) {
		:global(body:has(.sticky-actions):not(:has(.live-sticky-actions))) .toast-stack {
			top: auto;
			--toast-stack-bottom-base: calc(var(--mobile-chrome-bottom) + var(--sticky-actions-h) + 0.65rem);
			bottom: max(var(--toast-stack-bottom-base), var(--toast-stack-lift, 0px));
			flex-direction: column-reverse;
		}

		:global(body:has(.sticky-actions):not(:has(.live-sticky-actions)):has(.draft-dock))
			.toast-stack:not(.toast-stack--undo-snackbar) {
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

		:global(body:has(.sticky-actions):has(.draft-dock)) .toast-stack:not(.toast-stack--undo-snackbar) {
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
