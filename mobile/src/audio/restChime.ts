import {
	createAudioPlayer,
	setAudioModeAsync,
	type AudioPlayer
} from 'expo-audio';

const REST_SOURCE = require('../../assets/rest-done.wav');

let unlocked = false;
let player: AudioPlayer | null = null;
let loading: Promise<AudioPlayer | null> | null = null;

async function ensureMode(): Promise<void> {
	try {
		await setAudioModeAsync({
			playsInSilentMode: true,
			interruptionMode: 'duckOthers'
		});
	} catch {
		/* native module missing or mode rejected */
	}
}

async function loadPlayer(): Promise<AudioPlayer | null> {
	if (player) return player;
	if (loading) return loading;
	loading = (async () => {
		try {
			await ensureMode();
			player = createAudioPlayer(REST_SOURCE);
			return player;
		} catch {
			return null;
		} finally {
			loading = null;
		}
	})();
	return loading;
}

/** Call from a user gesture so iOS allows later timer playback. */
export function unlockRestAudioFromGesture(): void {
	if (unlocked) return;
	unlocked = true;
	void loadPlayer().then(async (p) => {
		if (!p) return;
		try {
			p.volume = 0.001;
			await p.seekTo(0);
			p.play();
			p.pause();
			p.volume = 1;
		} catch {
			/* ignore */
		}
	});
}

/** Short gym chime when rest timer hits zero (asset, no Web Audio). */
export async function playRestDoneChime(): Promise<void> {
	try {
		const p = await loadPlayer();
		if (!p) return;
		await ensureMode();
		await p.seekTo(0);
		p.volume = 1;
		p.play();
	} catch {
		/* ignore */
	}
}
