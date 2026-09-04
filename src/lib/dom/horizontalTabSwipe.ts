/** Horizontal swipe → tab prev/next. Vertical scroll stays free (touch-action: pan-y). */

export type HorizontalTabSwipeParams = {
	onNext: () => void;
	onPrev: () => void;
	/** Min |dx| in CSS px. Default 56 (~48 touch + slack). */
	thresholdPx?: number;
};

const IGNORE_SEL = 'input, textarea, select, [contenteditable="true"], [data-no-tab-swipe]';

export function horizontalTabSwipe(node: HTMLElement, params: HorizontalTabSwipeParams) {
	let opts = params;
	let startX = 0;
	let startY = 0;
	let tracking = false;
	let pointerId: number | null = null;

	function onDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if (e.isPrimary === false) return;
		const t = e.target;
		if (t instanceof Element && t.closest(IGNORE_SEL)) return;
		tracking = true;
		pointerId = e.pointerId;
		startX = e.clientX;
		startY = e.clientY;
	}

	function endTrack(e: PointerEvent) {
		if (!tracking || pointerId !== e.pointerId) return;
		tracking = false;
		pointerId = null;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		const th = opts.thresholdPx ?? 56;
		if (Math.abs(dx) < th) return;
		// Prefer horizontal: reject mostly-vertical pans.
		if (Math.abs(dx) < Math.abs(dy) * 1.35) return;
		if (dx < 0) opts.onNext();
		else opts.onPrev();
	}

	function onCancel(e: PointerEvent) {
		if (pointerId !== e.pointerId) return;
		tracking = false;
		pointerId = null;
	}

	node.addEventListener('pointerdown', onDown, { passive: true });
	node.addEventListener('pointerup', endTrack, { passive: true });
	node.addEventListener('pointercancel', onCancel, { passive: true });
	node.style.touchAction = 'pan-y';

	return {
		update(next: HorizontalTabSwipeParams) {
			opts = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', onDown);
			node.removeEventListener('pointerup', endTrack);
			node.removeEventListener('pointercancel', onCancel);
		}
	};
}
