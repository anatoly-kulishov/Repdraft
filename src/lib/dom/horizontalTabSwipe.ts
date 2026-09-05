/** Horizontal swipe → tab prev/next. Vertical scroll stays free (touch-action: pan-y). */

import { blurActiveElement } from '$lib/dom/blurActiveElement';

export type HorizontalTabSwipeParams = {
	onNext: () => void;
	onPrev: () => void;
	/** Min |dx| in CSS px. Default 56 (~48 touch + slack). */
	thresholdPx?: number;
};

/** Own horizontal gestures — do not steal for tab change. */
const HARD_IGNORE_SEL = '[data-no-tab-swipe], .onboarding-coachmark, .swipe-to-delete';
/** Fields where a swipe should still switch tabs, but with a slightly higher bar. */
const EDITABLE_SEL = 'input, textarea, select, [contenteditable="true"]';

export function horizontalTabSwipe(node: HTMLElement, params: HorizontalTabSwipeParams) {
	let opts = params;
	let startX = 0;
	let startY = 0;
	let tracking = false;
	let fromEditable = false;
	let pointerId: number | null = null;

	function onDown(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if (e.isPrimary === false) return;
		const t = e.target;
		if (t instanceof Element && t.closest(HARD_IGNORE_SEL)) return;
		tracking = true;
		fromEditable = t instanceof Element && Boolean(t.closest(EDITABLE_SEL));
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
		const baseTh = opts.thresholdPx ?? 56;
		const th = fromEditable ? Math.max(baseTh, 64) : baseTh;
		const bias = fromEditable ? 1.5 : 1.35;
		if (Math.abs(dx) < th) return;
		// Prefer horizontal: reject mostly-vertical pans.
		if (Math.abs(dx) < Math.abs(dy) * bias) return;
		if (fromEditable) blurActiveElement();
		if (dx < 0) opts.onNext();
		else opts.onPrev();
	}

	function onCancel(e: PointerEvent) {
		if (pointerId !== e.pointerId) return;
		tracking = false;
		pointerId = null;
		fromEditable = false;
	}

	node.addEventListener('pointerdown', onDown, { passive: true });
	node.addEventListener('pointerup', endTrack, { passive: true });
	node.addEventListener('pointercancel', onCancel, { passive: true });
	node.style.touchAction = 'pan-y';
	node.dataset.tabSwipe = '';

	return {
		update(next: HorizontalTabSwipeParams) {
			opts = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', onDown);
			node.removeEventListener('pointerup', endTrack);
			node.removeEventListener('pointercancel', onCancel);
			delete node.dataset.tabSwipe;
		}
	};
}
