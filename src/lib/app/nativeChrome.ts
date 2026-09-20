import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { isNativeApp } from '$lib/app/native';

/** Status bar polish for Apple 4.2 / store shells. Splash stays until hideNativeSplash. */
export async function initNativeChrome(): Promise<void> {
	if (!isNativeApp()) return;
	try {
		await StatusBar.setStyle({ style: Style.Dark });
		await StatusBar.setBackgroundColor({ color: '#0B0B0C' });
	} catch {
		/* web or unsupported */
	}
}

/** Hide Capacitor splash after web boot is ready (paired with launchAutoHide: false). */
export async function hideNativeSplash(): Promise<void> {
	if (!isNativeApp()) return;
	try {
		await SplashScreen.hide({ fadeOutDuration: 150 });
	} catch {
		/* already hidden */
	}
}
