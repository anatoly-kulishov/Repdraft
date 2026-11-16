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

function onTouchStart(event: TouchEvent) {
	startX = event.touches[0]?.clientX ?? 0;
	startY = event.touches[0]?.clientY ?? 0;
}

/** Native sliders handle their own horizontal drag; blocking touchmove breaks them. */
function isRangeInput(target: EventTarget | null): boolean {
	return target instanceof HTMLInputElement && target.type === 'range';
}

function onTouchMove(event: TouchEvent) {
	if (event.touches.length > 1) return;
	if (isRangeInput(event.target)) return;
	const x = event.touches[0]?.clientX ?? 0;
	const y = event.touches[0]?.clientY ?? 0;
	const deltaX = startX - x;
	const deltaY = startY - y;
	const horizontal = Math.abs(deltaX) > Math.abs(deltaY);
	let node = event.target instanceof HTMLElement ? event.target : null;
	while (node && node !== document.body) {
		if (isScrollableOnAxis(node, horizontal)) {
			const atStart = horizontal ? node.scrollLeft <= 0 : node.scrollTop <= 0;
			const atEnd = horizontal
				? node.scrollLeft + node.clientWidth >= node.scrollWidth - 1
				: node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
			const beyondStart = horizontal ? deltaX < 0 : deltaY < 0;
			const beyondEnd = horizontal ? deltaX > 0 : deltaY > 0;
			if ((beyondStart && atStart) || (beyondEnd && atEnd)) event.preventDefault();
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
