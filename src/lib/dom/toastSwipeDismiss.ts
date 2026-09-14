import { prefersReducedMotion } from '$lib/dom/prefersReducedMotion';

/** Ignore tiny jitter before choosing pan axis. */
export const TOAST_SWIPE_AXIS_PX = 8;
/** Prefer clear horizontal vs vertical. */
export const TOAST_SWIPE_AXIS_BIAS = 1.25;
/** px — drag past this dismisses. */
export const TOAST_SWIPE_DISMISS_PX = 64;
/** px/ms — flick past this dismisses even under position threshold. */
export const TOAST_SWIPE_FLICK_VX = 0.5;

export type ToastSwipeAxis = 'undecided' | 'h' | 'v';

export type ToastSwipeDismissParams = {
	onDismiss: () => void;
	onDrag: (dx: number, opacity: number) => void;
	onIdle: (animateReset: boolean) => void;
};

export function isToastSwipeInteractiveTarget(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false;
	return Boolean(target.closest('button, a, input, textarea, select, label, [role="button"]'));
}

export function toastSwipeShouldDismiss(dx: number, velocityX: number): boolean {
	if (Math.abs(dx) >= TOAST_SWIPE_DISMISS_PX) return true;
	if (dx > 0 && velocityX >= TOAST_SWIPE_FLICK_VX) return true;
	if (dx < 0 && velocityX <= -TOAST_SWIPE_FLICK_VX) return true;
	return false;
}

export function toastSwipeOpacity(dx: number): number {
	const fade = Math.min(1, Math.abs(dx) / (TOAST_SWIPE_DISMISS_PX * 1.35));
	return Math.max(0.35, 1 - fade * 0.65);
}

export function toastSwipeSkipResetMotion(): boolean {
	return prefersReducedMotion();
}

/** Native touch swipe-to-dismiss; touchmove is non-passive so horizontal lock can preventDefault. */
export function toastSwipeDismiss(node: HTMLElement, params: ToastSwipeDismissParams) {
	let current = params;
	let startX = 0;
	let startY = 0;
	let lastX = 0;
	let lastT = 0;
	let velocityX = 0;
	let axis: ToastSwipeAxis = 'undecided';
	let dx = 0;
	let tracking = false;

	function onTouchStart(event: TouchEvent) {
		if (event.touches.length !== 1) return;
		if (isToastSwipeInteractiveTarget(event.target)) return;
		const touch = event.touches[0];
		tracking = true;
		startX = touch.clientX;
		startY = touch.clientY;
		lastX = touch.clientX;
		lastT = performance.now();
		velocityX = 0;
		axis = 'undecided';
		dx = 0;
	}

	function onTouchMove(event: TouchEvent) {
		if (!tracking || event.touches.length !== 1) return;
		const touch = event.touches[0];
		const nextDx = touch.clientX - startX;
		const dy = touch.clientY - startY;
		const now = performance.now();
		const dt = Math.max(1, now - lastT);
		velocityX = (touch.clientX - lastX) / dt;
		lastX = touch.clientX;
		lastT = now;

		if (axis === 'undecided') {
			const adx = Math.abs(nextDx);
			const ady = Math.abs(dy);
			if (adx < TOAST_SWIPE_AXIS_PX && ady < TOAST_SWIPE_AXIS_PX) return;
			if (adx >= ady * TOAST_SWIPE_AXIS_BIAS) {
				axis = 'h';
			} else if (ady >= adx * TOAST_SWIPE_AXIS_BIAS) {
				axis = 'v';
				tracking = false;
				current.onIdle(false);
				return;
			} else {
				return;
			}
		}

		if (axis !== 'h') return;
		if (event.cancelable) event.preventDefault();
		dx = nextDx;
		current.onDrag(dx, toastSwipeOpacity(dx));
	}

	function endGesture(dismissible: boolean) {
		if (!tracking && axis !== 'h') {
			axis = 'undecided';
			dx = 0;
			return;
		}
		const wasHorizontal = axis === 'h';
		const endDx = dx;
		const endVx = velocityX;
		tracking = false;
		axis = 'undecided';
		dx = 0;

		if (dismissible && wasHorizontal && toastSwipeShouldDismiss(endDx, endVx)) {
			current.onDismiss();
			current.onIdle(false);
			return;
		}

		current.onIdle(wasHorizontal);
	}

	function onTouchEnd() {
		endGesture(true);
	}

	function onTouchCancel() {
		endGesture(false);
	}

	node.addEventListener('touchstart', onTouchStart, { passive: true });
	node.addEventListener('touchmove', onTouchMove, { passive: false });
	node.addEventListener('touchend', onTouchEnd);
	node.addEventListener('touchcancel', onTouchCancel);

	return {
		update(next: ToastSwipeDismissParams) {
			current = next;
		},
		destroy() {
			node.removeEventListener('touchstart', onTouchStart);
			node.removeEventListener('touchmove', onTouchMove);
			node.removeEventListener('touchend', onTouchEnd);
			node.removeEventListener('touchcancel', onTouchCancel);
		}
	};
}
