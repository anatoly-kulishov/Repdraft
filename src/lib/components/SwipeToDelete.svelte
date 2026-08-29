<script lang="ts" module>
	export type SwipeRowAction = {
		label: string;
		icon: typeof import('@lucide/svelte').Trash2;
		variant: 'danger' | 'accent';
		onAction: () => void;
		busy?: boolean;
	};
</script>

<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { Trash2 } from '@lucide/svelte';
	import { onMount, type Snippet } from 'svelte';

	const ACTION_WIDTH = 76;

	let {
		label,
		disabled = false,
		busy = false,
		onDelete,
		actions = null,
		children
	}: {
		label?: string;
		disabled?: boolean;
		busy?: boolean;
		onDelete?: () => void;
		actions?: SwipeRowAction[] | null;
		children: Snippet;
	} = $props();

	let railActions = $derived.by((): SwipeRowAction[] => {
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

	let reveal = $derived(railActions.length * ACTION_WIDTH);
	let openAt = $derived(Math.max(40, reveal * 0.52));

	let swipeOk = $state(false);
	let offset = $state(0);
	let open = $state(false);
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

	onMount(() => {
		const mq = window.matchMedia('(max-width: 1023px)');
		const sync = () => {
			swipeOk = mq.matches;
			if (!swipeOk) close();
		};
		const onScroll = () => {
			if (dragging) return;
			if (open || offset < 0) close();
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
		startOffset = open ? -reveal : 0;
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
		offset = Math.min(0, Math.max(-reveal, startOffset + dx));
	}

	function onPointerUp() {
		if (!dragging && axis !== 'h') {
			dragging = false;
			return;
		}
		dragging = false;
		if (axis === 'h') {
			open = offset <= -openAt;
			offset = open ? -reveal : 0;
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

	let showRail = $derived(swipeOk && (open || dragging || offset < 0));
</script>

<div
	class="swipe-to-delete"
	class:is-enabled={swipeOk}
	class:is-open={open}
	class:is-dragging={dragging}
	class:is-revealed={showRail}
	class:swipe-to-delete--multi={railActions.length > 1}
	style:--swipe-rail-width="{reveal}px"
>
	{#if showRail}
		<div class="swipe-to-delete__rail" aria-hidden={!open}>
			{#each railActions as action (action.label)}
				<AppButton
					variant="ghost"
					class={`swipe-to-delete__action swipe-to-delete__action--${action.variant} !min-h-0 !min-w-0 !h-full !w-full !rounded-none p-0`}
					disabled={disabled || action.busy}
					aria-busy={action.busy}
					aria-label={action.label}
					title={action.label}
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
		style:transform={showRail ? `translate3d(${offset}px, 0, 0)` : undefined}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onclick={onSheetClick}
	>
		{@render children()}
	</div>
</div>
