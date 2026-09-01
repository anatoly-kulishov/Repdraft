<script lang="ts" module>
	export type SwipeRowAction = {
		label: string;
		ariaLabel?: string;
		icon: typeof import('@lucide/svelte').Trash2;
		variant: 'danger' | 'accent' | 'success' | 'neutral';
		onAction: () => void;
		busy?: boolean;
	};
</script>

<script lang="ts">
	import { vibrateUndoTap } from '$lib/domain/prefs';
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { Trash2 } from '@lucide/svelte';
	import { onMount, type Snippet } from 'svelte';

	const ACTION_WIDTH = 72;

	type OpenSide = false | 'leading' | 'trailing';

	let {
		label,
		disabled = false,
		busy = false,
		onDelete,
		leadingActions = null,
		actions = null,
		children
	}: {
		label?: string;
		disabled?: boolean;
		busy?: boolean;
		onDelete?: () => void;
		leadingActions?: SwipeRowAction[] | null;
		actions?: SwipeRowAction[] | null;
		children: Snippet;
	} = $props();

	let trailingActions = $derived.by((): SwipeRowAction[] => {
		if (actions && actions.length > 0) return actions;
		return [
			{
				label: label ?? '',
				icon: Trash2,
				variant: 'danger',
				onAction: onDelete ?? (() => {}),
				busy
			}
		];
	});

	let leadingRail = $derived(leadingActions ?? []);
	let trailingReveal = $derived(trailingActions.length * ACTION_WIDTH);
	let leadingReveal = $derived(leadingRail.length * ACTION_WIDTH);
	let trailingOpenAt = $derived(Math.max(40, trailingReveal * 0.52));
	let leadingOpenAt = $derived(Math.max(40, leadingReveal * 0.52));

	let swipeOk = $state(false);
	let offset = $state(0);
	let open = $state<OpenSide>(false);
	let dragging = $state(false);
	let startX = 0;
	let startY = 0;
	let startOffset = 0;
	let axis: 'undecided' | 'h' | 'v' = 'undecided';
	let moved = false;
	let sheetEl = $state<HTMLDivElement | null>(null);

	function close() {
		offset = 0;
		open = false;
		dragging = false;
	}

	function claim() {
		document.dispatchEvent(new CustomEvent('repdraft:swipe-close', { detail: sheetEl }));
	}

	function onSwipeClose(event: Event) {
		const other = (event as CustomEvent<HTMLDivElement | null>).detail;
		if (other !== sheetEl) close();
	}

	function clampOffset(raw: number): number {
		const min = trailingReveal > 0 ? -trailingReveal : 0;
		const max = leadingReveal > 0 ? leadingReveal : 0;
		if (raw < min) return min + (raw - min) * 0.35;
		if (raw > max) return max + (raw - max) * 0.35;
		return raw;
	}

	onMount(() => {
		const mq = window.matchMedia('(max-width: 1023px)');
		const sync = () => {
			swipeOk = mq.matches;
			if (!swipeOk) close();
		};
		const onScroll = () => {
			if (dragging) return;
			if (open || offset !== 0) close();
		};
		sync();
		mq.addEventListener('change', sync);
		document.addEventListener('repdraft:swipe-close', onSwipeClose);
		window.addEventListener('scroll', onScroll, { passive: true, capture: true });
		return () => {
			mq.removeEventListener('change', sync);
			document.removeEventListener('repdraft:swipe-close', onSwipeClose);
			window.removeEventListener('scroll', onScroll, true);
		};
	});

	function onPointerDown(event: PointerEvent) {
		if (!swipeOk || disabled) return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		if (event.target instanceof Element && event.target.closest('[data-swipe-pass]')) return;
		claim();
		dragging = true;
		moved = false;
		axis = 'undecided';
		startX = event.clientX;
		startY = event.clientY;
		startOffset =
			open === 'trailing' ? -trailingReveal : open === 'leading' ? leadingReveal : 0;
		sheetEl?.setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging) return;
		const dx = event.clientX - startX;
		const dy = event.clientY - startY;
		if (axis === 'undecided') {
			if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
			axis = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
			if (axis === 'v') {
				dragging = false;
				offset = startOffset;
				return;
			}
		}
		moved = true;
		offset = clampOffset(startOffset + dx);
	}

	function onPointerUp() {
		if (!dragging && axis !== 'h') {
			dragging = false;
			return;
		}
		dragging = false;
		if (axis === 'h') {
			const wasOpen = open;
			if (trailingReveal > 0 && offset <= -trailingOpenAt) {
				open = 'trailing';
				offset = -trailingReveal;
			} else if (leadingReveal > 0 && offset >= leadingOpenAt) {
				open = 'leading';
				offset = leadingReveal;
			} else {
				open = false;
				offset = 0;
			}
			if (!wasOpen && open) vibrateUndoTap();
		}
		axis = 'undecided';
	}

	function onSheetClick(event: MouseEvent) {
		if (!swipeOk) return;
		if (moved) {
			event.preventDefault();
			event.stopPropagation();
			moved = false;
			return;
		}
		if (open) {
			event.preventDefault();
			event.stopPropagation();
			close();
		}
	}

	function onActionClick(event: MouseEvent, action: SwipeRowAction) {
		event.stopPropagation();
		close();
		action.onAction();
	}

	let sheetMoves = $derived(swipeOk && (dragging || open !== false || offset !== 0));
	let showLeadingRail = $derived(
		swipeOk && leadingReveal > 0 && (open === 'leading' || dragging || offset > 0)
	);
	let showTrailingRail = $derived(
		swipeOk && trailingReveal > 0 && (open === 'trailing' || dragging || offset < 0)
	);
</script>

<div
	class="swipe-to-delete"
	class:is-enabled={swipeOk}
	class:is-open={open !== false}
	class:is-open-leading={open === 'leading'}
	class:is-open-trailing={open === 'trailing'}
	class:is-dragging={dragging}
	class:is-revealed-leading={showLeadingRail}
	class:is-revealed-trailing={showTrailingRail}
	class:swipe-to-delete--leading={leadingRail.length > 0}
	class:swipe-to-delete--trailing={trailingActions.length > 0}
	class:swipe-to-delete--multi={trailingActions.length > 1}
	style:--swipe-leading-width="{leadingReveal}px"
	style:--swipe-trailing-width="{trailingReveal}px"
>
	{#if showLeadingRail}
		<div class="swipe-to-delete__rail swipe-to-delete__rail--leading" aria-hidden={open !== 'leading'}>
			{#each leadingRail as action (action.label)}
				<AppButton
					variant="ghost"
					class={`swipe-to-delete__action swipe-to-delete__action--${action.variant}`}
					disabled={disabled || action.busy}
					aria-busy={action.busy}
					aria-label={action.ariaLabel ?? action.label}
					title={action.ariaLabel ?? action.label}
					onclick={(event) => onActionClick(event, action)}
				>
					{#if action.busy}
						<Spinner size="sm" block={false} />
					{:else}
						<LucideIcon icon={action.icon} size={ICON_BUTTON} />
					{/if}
				</AppButton>
			{/each}
		</div>
	{/if}
	{#if showTrailingRail}
		<div
			class="swipe-to-delete__rail swipe-to-delete__rail--trailing"
			aria-hidden={open !== 'trailing'}
		>
			{#each trailingActions as action (action.label)}
				<AppButton
					variant="ghost"
					class={`swipe-to-delete__action swipe-to-delete__action--${action.variant}`}
					disabled={disabled || action.busy}
					aria-busy={action.busy}
					aria-label={action.ariaLabel ?? action.label}
					title={action.ariaLabel ?? action.label}
					onclick={(event) => onActionClick(event, action)}
				>
					{#if action.busy}
						<Spinner size="sm" block={false} />
					{:else}
						<LucideIcon icon={action.icon} size={ICON_BUTTON} />
					{/if}
				</AppButton>
			{/each}
		</div>
	{/if}
	<!-- Gesture sheet: pointer handlers are intentional; keyboard users keep row actions. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		bind:this={sheetEl}
		class="swipe-to-delete__sheet"
		style:transform={sheetMoves ? `translate3d(${offset}px, 0, 0)` : undefined}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onclick={onSheetClick}
	>
		{@render children()}
	</div>
</div>
