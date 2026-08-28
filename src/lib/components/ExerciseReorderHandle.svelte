<script lang="ts">
	import AppIconButton from '$lib/components/AppIconButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { cn } from '$lib/utils.js';
	import { GripVertical } from '@lucide/svelte';

	const HOLD_MS_DEFAULT = 360;
	const MOVE_CANCEL_PX = 12;

	let {
		index,
		label,
		onreorder,
		holdMs = HOLD_MS_DEFAULT,
		targetSelector = '[data-builder-index]',
		indexAttribute = 'data-builder-index',
		rootActiveClass = 'is-builder-reorder-active',
		eventName = 'repdraft:builder-reorder'
	}: {
		index: number;
		label: string;
		onreorder: (from: number, to: number) => void;
		holdMs?: number;
		targetSelector?: string;
		indexAttribute?: string;
		rootActiveClass?: string;
		eventName?: string;
	} = $props();

	let active = $state(false);
	let pressing = $state(false);
	let fromIndex = $state<number | null>(null);
	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let pressOrigin = { x: 0, y: 0 };

	function rowCount(): number {
		return document.querySelectorAll(targetSelector).length;
	}

	function resolveTarget(clientY: number): number | null {
		const el = document.elementFromPoint(window.innerWidth / 2, clientY);
		const row = el?.closest(targetSelector);
		if (!row) return null;
		const raw = row.getAttribute(indexAttribute);
		if (raw === null || raw === '') return null;
		const rowIndex = Number(raw);
		if (Number.isNaN(rowIndex)) return null;
		const rect = row.getBoundingClientRect();
		const mid = rect.top + rect.height / 2;
		const max = Math.max(0, rowCount() - 1);
		return clientY >= mid ? Math.min(rowIndex + 1, max) : rowIndex;
	}

	function emitPhase(from: number | null, over: number | null) {
		document.dispatchEvent(
			new CustomEvent(eventName, {
				detail: { from, over }
			})
		);
	}

	function clearPressListeners() {
		window.removeEventListener('pointermove', onPressMove);
		window.removeEventListener('pointerup', onPressEnd);
		window.removeEventListener('pointercancel', onPressEnd);
	}

	function clearPressTimer() {
		if (pressTimer !== null) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}

	function cancelPress() {
		clearPressTimer();
		pressing = false;
		clearPressListeners();
	}

	function onWindowMove(event: PointerEvent) {
		if (!active || fromIndex === null) return;
		emitPhase(fromIndex, resolveTarget(event.clientY));
	}

	function endDrag(event: PointerEvent) {
		if (!active || fromIndex === null) return;
		const from = fromIndex;
		const to = resolveTarget(event.clientY);
		window.removeEventListener('pointermove', onWindowMove);
		window.removeEventListener('pointerup', endDrag);
		window.removeEventListener('pointercancel', endDrag);
		document.documentElement.classList.remove(rootActiveClass);
		emitPhase(null, null);
		if (to !== null && to !== from) onreorder(from, to);
		active = false;
		fromIndex = null;
	}

	function beginDrag() {
		clearPressTimer();
		pressing = false;
		clearPressListeners();
		active = true;
		fromIndex = index;
		document.documentElement.classList.add(rootActiveClass);
		emitPhase(index, index);
		window.addEventListener('pointermove', onWindowMove);
		window.addEventListener('pointerup', endDrag);
		window.addEventListener('pointercancel', endDrag);
	}

	function onPressMove(event: PointerEvent) {
		if (active) return;
		const dx = event.clientX - pressOrigin.x;
		const dy = event.clientY - pressOrigin.y;
		if (Math.hypot(dx, dy) >= MOVE_CANCEL_PX) cancelPress();
	}

	function onPressEnd() {
		cancelPress();
	}

	function onPointerDown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		event.stopPropagation();
		cancelPress();
		if (holdMs <= 0) {
			beginDrag();
			return;
		}
		pressing = true;
		pressOrigin = { x: event.clientX, y: event.clientY };
		pressTimer = setTimeout(beginDrag, holdMs);
		window.addEventListener('pointermove', onPressMove);
		window.addEventListener('pointerup', onPressEnd);
		window.addEventListener('pointercancel', onPressEnd);
	}
</script>

<AppIconButton
	class={cn('reorder-handle exercise-reorder-handle', pressing && 'reorder-handle--pressing')}
	type="button"
	data-swipe-pass=""
	aria-label={label}
	title={label}
	onpointerdown={onPointerDown}
>
	<LucideIcon icon={GripVertical} size={ICON_SMALL} />
</AppIconButton>
