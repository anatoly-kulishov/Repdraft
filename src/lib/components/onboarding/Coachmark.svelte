<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { onboardingHydrated } from '$lib/stores/onboarding';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Sparkles, X } from '@lucide/svelte';

	const AXIS_LOCK_PX = 12;
	const AXIS_BIAS = 1.45;
	const DISMISS_PX = 72;
	const FLICK_VX = 0.55;

	let {
		message,
		onDismiss,
		class: className = ''
	}: {
		message: string;
		onDismiss: () => void;
		class?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
	let rootEl = $state<HTMLDivElement | null>(null);
	let offsetX = $state(0);
	let dragging = $state(false);
	let axis = $state<'undecided' | 'h' | 'v'>('undecided');
	let leaving = $state(false);
	let startX = 0;
	let startY = 0;
	let lastX = 0;
	let lastT = 0;
	let velocityX = 0;

	function releaseCapture(pointerId: number) {
		try {
			rootEl?.releasePointerCapture(pointerId);
		} catch {
			/* already released */
		}
	}

	function finishDismiss(dir: 1 | -1) {
		if (leaving) return;
		leaving = true;
		offsetX = dir * Math.max(160, (rootEl?.offsetWidth ?? 240) * 0.85);
		window.setTimeout(() => onDismiss(), 180);
	}

	function onPointerDown(event: PointerEvent) {
		if (leaving) return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		if (event.isPrimary === false) return;
		if (event.target instanceof Element && event.target.closest('button, a')) return;
		dragging = true;
		axis = 'undecided';
		velocityX = 0;
		startX = event.clientX;
		startY = event.clientY;
		lastX = event.clientX;
		lastT = performance.now();
		/* Capture only after horizontal lock — keep page scroll free. */
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging || leaving) return;
		const dx = event.clientX - startX;
		const dy = event.clientY - startY;
		const now = performance.now();
		const dt = Math.max(8, now - lastT);
		velocityX = (event.clientX - lastX) / dt;
		lastX = event.clientX;
		lastT = now;

		if (axis === 'undecided') {
			const adx = Math.abs(dx);
			const ady = Math.abs(dy);
			if (adx < AXIS_LOCK_PX && ady < AXIS_LOCK_PX) return;
			if (adx >= ady * AXIS_BIAS) {
				axis = 'h';
				rootEl?.setPointerCapture(event.pointerId);
			} else if (ady >= adx * AXIS_BIAS) {
				axis = 'v';
				dragging = false;
				offsetX = 0;
				return;
			} else {
				return;
			}
		}
		if (axis !== 'h') return;
		offsetX = dx * 0.92;
	}

	function onPointerUp(event: PointerEvent) {
		if (!dragging && axis !== 'h') {
			dragging = false;
			axis = 'undecided';
			return;
		}
		dragging = false;
		releaseCapture(event.pointerId);
		if (axis === 'h') {
			const flick = Math.abs(velocityX) >= FLICK_VX;
			const far = Math.abs(offsetX) >= DISMISS_PX;
			if (far || (flick && Math.abs(offsetX) > 20)) {
				finishDismiss(offsetX >= 0 ? 1 : -1);
			} else {
				offsetX = 0;
			}
		}
		axis = 'undecided';
		velocityX = 0;
	}

	let dragOpacity = $derived(
		leaving || Math.abs(offsetX) < 1
			? undefined
			: Math.max(0.35, 1 - Math.abs(offsetX) / 180)
	);
</script>

{#if $onboardingHydrated}
	<!-- Swipe-to-dismiss: pointer handlers intentional; X button remains for keyboard / precise tap. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={rootEl}
		class="onboarding-coachmark panel {className}"
		class:is-dragging={dragging && axis === 'h'}
		class:is-leaving={leaving}
		role="note"
		data-no-tab-swipe
		style:transform={offsetX !== 0 || leaving ? `translate3d(${offsetX}px, 0, 0)` : undefined}
		style:opacity={leaving ? Math.max(0.15, 1 - Math.abs(offsetX) / 220) : dragOpacity}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
	>
		<div class="onboarding-coachmark__body">
			<span class="onboarding-coachmark__icon" aria-hidden="true">
				<LucideIcon icon={Sparkles} size={ICON_SMALL} />
			</span>
			<p class="onboarding-coachmark__text">{message}</p>
		</div>
		<AppButton
			variant="ghost"
			class="onboarding-coachmark__dismiss"
			onclick={onDismiss}
			aria-label={translate(lang, 'a11y.close')}
		>
			<LucideIcon icon={X} size={ICON_SMALL} />
		</AppButton>
	</div>
{/if}
