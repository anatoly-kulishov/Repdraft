/**
 * Scroll a focused field toward the middle of the visible viewport.
 * Re-runs once after visualViewport resize so iOS keyboard settle still centers the field.
 */
export function scrollFieldIntoView(el: HTMLElement, behavior: ScrollBehavior = 'smooth'): void {
	const run = () => {
		el.scrollIntoView({ block: 'center', inline: 'nearest', behavior });
	};

	queueMicrotask(run);

	const vv = typeof window !== 'undefined' ? window.visualViewport : null;
	if (!vv) {
		window.setTimeout(run, 280);
		return;
	}

	let done = false;
	const cleanup = () => {
		if (done) return;
		done = true;
		vv.removeEventListener('resize', onResize);
		window.clearTimeout(timer);
	};

	const onResize = () => {
		run();
		requestAnimationFrame(run);
		cleanup();
	};

	vv.addEventListener('resize', onResize);
	const timer = window.setTimeout(() => {
		run();
		cleanup();
	}, 450);
}
