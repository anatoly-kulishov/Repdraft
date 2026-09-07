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
let startY = 0;

function isVerticallyScrollable(el: HTMLElement): boolean {
	const { overflowY } = getComputedStyle(el);
	if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') return false;
	return el.scrollHeight > el.clientHeight + 1;
}

function onTouchStart(event: TouchEvent) {
	startY = event.touches[0]?.clientY ?? 0;
}

function onTouchMove(event: TouchEvent) {
	if (event.touches.length > 1) return;
	const y = event.touches[0]?.clientY ?? 0;
	const deltaY = startY - y;
	let node = event.target instanceof HTMLElement ? event.target : null;
	while (node && node !== document.body) {
		if (isVerticallyScrollable(node)) {
			const atTop = node.scrollTop <= 0;
			const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
			if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
				event.preventDefault();
			}
			return;
		}
		node = node.parentElement;
	}
	event.preventDefault();
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
