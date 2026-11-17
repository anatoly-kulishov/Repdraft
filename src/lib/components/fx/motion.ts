import type { Attachment } from 'svelte/attachments';

export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return true;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function hasFinePointer(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/** Pause CSS fx animations while the host is offscreen or the tab is hidden. */
export const fxPauseOffscreen: Attachment<HTMLElement> = (node) => {
	if (typeof IntersectionObserver === 'undefined') return;
	let visible = true;
	const sync = () => {
		node.dataset.fxPaused = !visible || document.hidden ? 'true' : 'false';
	};
	const io = new IntersectionObserver(
		(entries) => {
			visible = entries.some((e) => e.isIntersecting);
			sync();
		},
		{ rootMargin: '64px' }
	);
	io.observe(node);
	document.addEventListener('visibilitychange', sync);
	return () => {
		io.disconnect();
		document.removeEventListener('visibilitychange', sync);
	};
};

export type FxBox = { x: number; y: number; w: number; h: number };

function easeOutCubic(t: number): number {
	return 1 - (1 - t) ** 3;
}

/** rAF tween between two boxes; returns a cancel fn. Snaps when motion is reduced. */
export function tweenBox(
	from: FxBox,
	to: FxBox,
	ms: number,
	onFrame: (box: FxBox) => void,
	delayMs = 0
): () => void {
	if (ms <= 0 || prefersReducedMotion()) {
		onFrame(to);
		return () => {};
	}
	let raf = 0;
	let start = 0;
	const step = (now: number) => {
		if (!start) start = now + delayMs;
		const p = Math.min(1, Math.max(0, (now - start) / ms));
		const e = easeOutCubic(p);
		onFrame({
			x: from.x + (to.x - from.x) * e,
			y: from.y + (to.y - from.y) * e,
			w: from.w + (to.w - from.w) * e,
			h: from.h + (to.h - from.h) * e
		});
		if (p < 1) raf = requestAnimationFrame(step);
	};
	raf = requestAnimationFrame(step);
	return () => cancelAnimationFrame(raf);
}

/** Offset box of an element inside its offset parent (ignores transforms). */
export function offsetBox(el: HTMLElement): FxBox {
	return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
}

type MagneticOptions = {
	/** 0..1 share of pointer offset applied to the element. */
	strength?: number;
	/** Extra reach (px) around the element where the pull starts. */
	radius?: number;
};

/** Pull an element toward the pointer (mouse / trackpad only). */
export function magnetic(options: MagneticOptions = {}): Attachment<HTMLElement> {
	return (node) => {
		if (!hasFinePointer() || prefersReducedMotion()) return;
		const strength = options.strength ?? 0.32;
		const reach = options.radius ?? 72;
		const inner = node.querySelector<HTMLElement>('[data-magnetic-inner]');
		let tx = 0;
		let ty = 0;
		let raf = 0;
		let px = 0;
		let py = 0;

		node.style.willChange = 'transform';

		const paint = () => {
			raf = 0;
			const rect = node.getBoundingClientRect();
			const cx = rect.left + rect.width / 2 - tx;
			const cy = rect.top + rect.height / 2 - ty;
			const dx = px - cx;
			const dy = py - cy;
			const limit = reach + Math.max(rect.width, rect.height) / 2;
			const inside = Math.hypot(dx, dy) < limit;
			tx = inside ? dx * strength : 0;
			ty = inside ? dy * strength : 0;
			node.style.transition = inside
				? 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1)'
				: 'transform 520ms cubic-bezier(0.34, 1.56, 0.64, 1)';
			node.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
			if (inner) {
				inner.style.transition = node.style.transition;
				inner.style.transform = `translate3d(${tx * 0.35}px, ${ty * 0.35}px, 0)`;
			}
		};

		const onMove = (e: PointerEvent) => {
			px = e.clientX;
			py = e.clientY;
			if (!raf) raf = requestAnimationFrame(paint);
		};
		const onLeave = () => {
			px = -9999;
			py = -9999;
			if (!raf) raf = requestAnimationFrame(paint);
		};

		window.addEventListener('pointermove', onMove, { passive: true });
		document.documentElement.addEventListener('pointerleave', onLeave);
		return () => {
			window.removeEventListener('pointermove', onMove);
			document.documentElement.removeEventListener('pointerleave', onLeave);
			if (raf) cancelAnimationFrame(raf);
			node.style.transform = '';
			node.style.transition = '';
			node.style.willChange = '';
			if (inner) inner.style.transform = '';
		};
	};
}
