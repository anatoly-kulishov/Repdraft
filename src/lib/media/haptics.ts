/** Haptics: Capacitor on native, navigator.vibrate on web. Domain prefs stay pure. */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativeApp } from '$lib/app/native';
import { vibrateRestDone, vibrateSetDone, vibrateUndoTap } from '$lib/domain/prefs';

export async function hapticSetDone(): Promise<void> {
	if (isNativeApp()) {
		try {
			await Haptics.impact({ style: ImpactStyle.Medium });
			return;
		} catch {
			/* fall through */
		}
	}
	vibrateSetDone();
}

export async function hapticRestDone(): Promise<void> {
	if (isNativeApp()) {
		try {
			await Haptics.notification({ type: NotificationType.Success });
			return;
		} catch {
			/* fall through */
		}
	}
	vibrateRestDone();
}

export async function hapticUndoTap(): Promise<void> {
	if (isNativeApp()) {
		try {
			await Haptics.impact({ style: ImpactStyle.Light });
			return;
		} catch {
			/* fall through */
		}
	}
	vibrateUndoTap();
}
