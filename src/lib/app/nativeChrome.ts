import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { isNativeApp } from '$lib/app/native';

/** Status bar + splash polish for Apple 4.2 / store shells. */
export async function initNativeChrome(): Promise<void> {
	if (!isNativeApp()) return;
	try {
		await StatusBar.setStyle({ style: Style.Dark });
		await StatusBar.setBackgroundColor({ color: '#0B0B0C' });
	} catch {
		/* web or unsupported */
	}
	try {
		await SplashScreen.hide();
	} catch {
		/* already hidden */
	}
}
