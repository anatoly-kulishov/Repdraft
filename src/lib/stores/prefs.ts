import { browser } from '$app/environment';
import {
	parseRestSoundEnabled,
	parseTesterModeEnabled,
	parseWebAnalyticsEnabled,
	playRestDoneChime,
	REST_SOUND_STORAGE_KEY,
	TESTER_MODE_STORAGE_KEY,
	WEB_ANALYTICS_STORAGE_KEY,
	unlockAudioFromGesture
} from '$lib/domain/prefs';
import { hapticRestDone } from '$lib/media/haptics';
import { writable, type Writable } from 'svelte/store';

type LocalBoolPref = Writable<boolean> & {
	toggle: () => void;
};

function createLocalBoolPref(opts: {
	key: string;
	parse: (raw: string | null | undefined) => boolean;
	fallback: boolean;
	onEnable?: () => void;
}): LocalBoolPref {
	const read = (): boolean => {
		if (!browser) return opts.fallback;
		try {
			return opts.parse(localStorage.getItem(opts.key));
		} catch {
			return opts.fallback;
		}
	};

	const { subscribe, set, update } = writable(read());

	if (browser) {
		subscribe((enabled) => {
			try {
				localStorage.setItem(opts.key, enabled ? '1' : '0');
			} catch {
				/* ignore */
			}
		});
	}

	return {
		subscribe,
		set(enabled: boolean) {
			set(enabled);
			if (enabled) opts.onEnable?.();
		},
		update,
		toggle() {
			update((v) => {
				const next = !v;
				if (next) opts.onEnable?.();
				return next;
			});
		}
	};
}

function previewRestFeedback() {
	unlockAudioFromGesture();
	void hapticRestDone();
	playRestDoneChime();
}

/** Local preference: chime when live rest timer ends. Default on. */
export const restSoundEnabled = createLocalBoolPref({
	key: REST_SOUND_STORAGE_KEY,
	parse: parseRestSoundEnabled,
	fallback: true,
	onEnable: previewRestFeedback
});

/** Opt-in web-only Vercel Analytics / Speed Insights. Default off. */
export const webAnalyticsEnabled = createLocalBoolPref({
	key: WEB_ANALYTICS_STORAGE_KEY,
	parse: parseWebAnalyticsEnabled,
	fallback: false
});

/** Opt-in local tester tools (wipe / stress backup / scenarios). Default off. */
export const testerModeEnabled = createLocalBoolPref({
	key: TESTER_MODE_STORAGE_KEY,
	parse: parseTesterModeEnabled,
	fallback: false
});
