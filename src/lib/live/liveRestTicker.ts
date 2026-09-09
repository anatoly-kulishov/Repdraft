import { get } from 'svelte/store';
import { playRestDoneChime, unlockAudioFromGesture } from '$lib/domain/prefs';
import { hapticRestDone } from '$lib/media/haptics';
import { live } from '$lib/stores/live';
import { restSoundEnabled } from '$lib/stores/prefs';

export type LiveRestTicker = {
	stop: () => void;
};

/** Clock + rest expiry tick; chime when rest ends if armed and sound enabled. */
export function startLiveRestTicker(handlers: {
	onNow: (now: number) => void;
	getRestChimeArmed: () => boolean;
	setRestChimeArmed: (armed: boolean) => void;
	intervalMs?: number;
}): LiveRestTicker {
	const unlockOnce = () => unlockAudioFromGesture();
	window.addEventListener('pointerdown', unlockOnce, { once: true, capture: true });

	const intervalMs = handlers.intervalMs ?? 250;
	const tick = setInterval(() => {
		const now = Date.now();
		handlers.onNow(now);
		const until = get(live).restUntil;
		if (until != null && until <= now) {
			if (handlers.getRestChimeArmed() && get(restSoundEnabled)) {
				void hapticRestDone();
				playRestDoneChime();
			}
			handlers.setRestChimeArmed(false);
			live.skipRest();
		}
	}, intervalMs);

	return {
		stop: () => {
			clearInterval(tick);
			window.removeEventListener('pointerdown', unlockOnce, { capture: true });
		}
	};
}
