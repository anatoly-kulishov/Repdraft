import { browser } from '$app/environment';
	import {
		parseRestSoundEnabled,
		playRestDoneChime,
		REST_SOUND_STORAGE_KEY,
		unlockAudioFromGesture
	} from '$lib/domain/prefs';
	import { writable } from 'svelte/store';

	function readRestSound(): boolean {
		if (!browser) return true;
		try {
			return parseRestSoundEnabled(localStorage.getItem(REST_SOUND_STORAGE_KEY));
		} catch {
			return true;
		}
	}

	function createRestSoundStore() {
		const { subscribe, set, update } = writable(readRestSound());

		if (browser) {
			subscribe((enabled) => {
				try {
					localStorage.setItem(REST_SOUND_STORAGE_KEY, enabled ? '1' : '0');
				} catch {
					/* ignore */
				}
			});
		}

		return {
			subscribe,
			set(enabled: boolean) {
				set(enabled);
				if (enabled) {
					unlockAudioFromGesture();
					playRestDoneChime();
				}
			},
			toggle() {
				update((v) => {
					const next = !v;
					if (next) {
						unlockAudioFromGesture();
						playRestDoneChime();
					}
					return next;
				});
			}
		};
	}

/** Local preference: chime when live rest timer ends. Default on. */
export const restSoundEnabled = createRestSoundStore();
