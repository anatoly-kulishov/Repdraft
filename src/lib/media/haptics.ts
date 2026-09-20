/** Haptics via navigator.vibrate. Domain prefs stay pure. */
import { vibrateRestDone, vibrateSetDone, vibrateUndoTap } from '$lib/domain/prefs';

export async function hapticSetDone(): Promise<void> {
	vibrateSetDone();
}

export async function hapticRestDone(): Promise<void> {
	vibrateRestDone();
}

export async function hapticUndoTap(): Promise<void> {
	vibrateUndoTap();
}
