const TOAST_LIFT_GAP_PX = 10;

const TOAST_LIFT_SELECTORS = [
	'[data-slot="sheet-content"][data-side="bottom"] .bottom-sheet__card',
	'.draft-dock-wrap__hint'
] as const;

export function isToastLiftTargetVisible(el: Element): boolean {
	const rect = el.getBoundingClientRect();
	if (rect.height < 1 || rect.width < 1) return false;
	const style = getComputedStyle(el);
	return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0;
}

/** Distance from viewport bottom to clear sheets / draft-dock coachmarks. */
export function measureToastStackLift(viewportHeight = window.innerHeight): number {
	let lift = 0;
	for (const selector of TOAST_LIFT_SELECTORS) {
		for (const el of document.querySelectorAll(selector)) {
			if (!isToastLiftTargetVisible(el)) continue;
			const sheet = el.closest('[data-slot="sheet-content"]');
			if (sheet && !isToastLiftTargetVisible(sheet)) continue;
			const rect = el.getBoundingClientRect();
			lift = Math.max(lift, viewportHeight - rect.top + TOAST_LIFT_GAP_PX);
		}
	}
	return lift;
}

export function syncToastStackLift(): void {
	if (typeof document === 'undefined') return;
	const lift = measureToastStackLift();
	document.documentElement.style.setProperty(
		'--toast-stack-lift',
		lift > 0 ? `${lift}px` : '0px'
	);
}

export function watchToastStackLift(): () => void {
	if (typeof window === 'undefined') return () => {};

	let frame = 0;
	const schedule = () => {
		if (frame) cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			frame = 0;
			syncToastStackLift();
		});
	};

	schedule();
	const ro = new ResizeObserver(schedule);
	ro.observe(document.body);
	const mo = new MutationObserver(schedule);
	mo.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['class', 'data-state', 'style', 'open']
	});
	window.addEventListener('resize', schedule);
	window.addEventListener('scroll', schedule, true);

	return () => {
		if (frame) cancelAnimationFrame(frame);
		ro.disconnect();
		mo.disconnect();
		window.removeEventListener('resize', schedule);
		window.removeEventListener('scroll', schedule, true);
		document.documentElement.style.removeProperty('--toast-stack-lift');
	};
}
