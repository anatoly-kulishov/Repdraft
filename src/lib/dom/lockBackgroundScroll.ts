/**
 * Prevent background page scroll while a modal/sheet/lightbox is open.
 * bits-ui locks body, but iOS still chains touch overscroll into .shell-main;
 * capture-phase touchmove + html overflow cover that gap.
 *
 * Ref-counted so nested overlays (e.g. lightbox + rename sheet) stay locked
 * until the last one closes.
 */

let lockCount = 0;
let prevHtmlOverflow = '';
let prevBodyOverflow = '';
let startX = 0;
let startY = 0;

function isScrollableOnAxis(el: HTMLElement, horizontal: boolean): boolean {
	const style = getComputedStyle(el);
	const overflow = horizontal ? style.overflowX : style.overflowY;
	if (overflow !== 'auto' && overflow !== 'scroll' && overflow !== 'overlay') return false;
	return horizontal
		? el.scrollWidth > el.clientWidth + 1
		: el.scrollHeight > el.clientHeight + 1;
}

/** Innermost ancestor of `target` that can pan on the asked axis. */
function findScrollable(target: EventTarget | null, horizontal: boolean): HTMLElement | null {
	let node = target instanceof HTMLElement ? target : null;
	while (node && node !== document.body) {
		if (isScrollableOnAxis(node, horizontal)) return node;
		node = node.parentElement;
	}
	return null;
}

function onTouchStart(event: TouchEvent) {
	startX = event.touches[0]?.clientX ?? 0;
	startY = event.touches[0]?.clientY ?? 0;
}

/** Native sliders handle their own horizontal drag; blocking touchmove breaks them. */
function isRangeInput(target: EventTarget | null): boolean {
	return target instanceof HTMLInputElement && target.type === 'range';
}

/**
 * A gesture counts as horizontal only when it clearly is one. The first frame of a
 * thumb swipe is a few pixels of noise, so picking the axis there can hand a
 * vertical drag to the horizontal branch — and its preventDefault kills the pan
 * for the whole gesture on iOS.
 */
function isHorizontalGesture(deltaX: number, deltaY: number): boolean {
	return Math.abs(deltaX) > 6 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5;
}

/** True when the scroller is already pinned at the edge the finger is pulling past. */
function pullsPastEdge(node: HTMLElement, horizontal: boolean, deltaX: number, deltaY: number) {
	const atStart = horizontal ? node.scrollLeft <= 0 : node.scrollTop <= 0;
	const atEnd = horizontal
		? node.scrollLeft + node.clientWidth >= node.scrollWidth - 1
		: node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
	const beyondStart = horizontal ? deltaX < 0 : deltaY < 0;
	const beyondEnd = horizontal ? deltaX > 0 : deltaY > 0;
	return (beyondStart && atStart) || (beyondEnd && atEnd);
}

function onTouchMove(event: TouchEvent) {
	if (event.touches.length > 1) return;
	if (isRangeInput(event.target)) return;
	const x = event.touches[0]?.clientX ?? 0;
	const y = event.touches[0]?.clientY ?? 0;
	const deltaX = startX - x;
	const deltaY = startY - y;
	let horizontal = isHorizontalGesture(deltaX, deltaY);
	let node = findScrollable(event.target, horizontal);
	// Slanted start of a vertical swipe: fall back to the other axis before
	// cancelling anything, otherwise the sheet stops scrolling mid-gesture.
	if (!node) {
		horizontal = !horizontal;
		node = findScrollable(event.target, horizontal);
	}
	if (!node) {
		event.preventDefault();
		return;
	}
	if (pullsPastEdge(node, horizontal, deltaX, deltaY)) event.preventDefault();
}

function attachListeners() {
	document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
	document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
}

function detachListeners() {
	document.removeEventListener('touchstart', onTouchStart, true);
	document.removeEventListener('touchmove', onTouchMove, true);
}

/** Call while overlay is open; invoke returned function on close. */
export function lockBackgroundScroll(): () => void {
	if (typeof document === 'undefined') return () => {};

	const html = document.documentElement;
	const body = document.body;

	if (lockCount === 0) {
		prevHtmlOverflow = html.style.overflow;
		prevBodyOverflow = body.style.overflow;
		html.style.overflow = 'hidden';
		body.style.overflow = 'hidden';
		attachListeners();
	}
	lockCount += 1;

	let released = false;
	return () => {
		if (released) return;
		released = true;
		lockCount = Math.max(0, lockCount - 1);
		if (lockCount > 0) return;
		html.style.overflow = prevHtmlOverflow;
		body.style.overflow = prevBodyOverflow;
		prevHtmlOverflow = '';
		prevBodyOverflow = '';
		detachListeners();
	};
}
