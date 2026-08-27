<script lang="ts">
	import AppIconButton from '$lib/components/AppIconButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { GripVertical } from '@lucide/svelte';

	let {
		index,
		label,
		onreorder
	}: {
		index: number;
		label: string;
		onreorder: (from: number, to: number) => void;
	} = $props();

	let active = $state(false);
	let fromIndex = $state<number | null>(null);

	function resolveTarget(clientY: number): number | null {
		const el = document.elementFromPoint(window.innerWidth / 2, clientY);
		const row = el?.closest('[data-builder-index]');
		if (!row) return null;
		const raw = row.getAttribute('data-builder-index');
		if (raw === null || raw === '') return null;
		const rowIndex = Number(raw);
		if (Number.isNaN(rowIndex)) return null;
		const rect = row.getBoundingClientRect();
		const mid = rect.top + rect.height / 2;
		return clientY >= mid ? Math.min(rowIndex + 1, document.querySelectorAll('[data-builder-index]').length - 1) : rowIndex;
	}

	function emitPhase(from: number | null, over: number | null) {
		document.dispatchEvent(
			new CustomEvent('repdraft:builder-reorder', {
				detail: { from, over }
			})
		);
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
		document.documentElement.classList.remove('is-builder-reorder-active');
		// Clear drag highlight — previously emitPhase(null) still sent fromIndex, so the row stayed at 0.55 opacity.
		emitPhase(null, null);
		if (to !== null && to !== from) onreorder(from, to);
		active = false;
		fromIndex = null;
	}

	function onPointerDown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		event.stopPropagation();
		event.preventDefault();
		active = true;
		fromIndex = index;
		document.documentElement.classList.add('is-builder-reorder-active');
		emitPhase(index, index);
		window.addEventListener('pointermove', onWindowMove);
		window.addEventListener('pointerup', endDrag);
		window.addEventListener('pointercancel', endDrag);
	}
</script>

<AppIconButton
	class="exercise-reorder-handle"
	type="button"
	aria-label={label}
	title={label}
	onpointerdown={onPointerDown}
>
	<LucideIcon icon={GripVertical} size={ICON_SMALL} />
</AppIconButton>
