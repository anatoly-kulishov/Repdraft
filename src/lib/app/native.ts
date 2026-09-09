import { browser } from '$app/environment';
import { Capacitor } from '@capacitor/core';
import {
	resolveWebApiOrigin,
	webAnalyticsAvailable
} from '$lib/app/nativeUrls';

/**
 * Native Capacitor shell (iOS/Android WebView).
 * Prefer runtime Capacitor.isNativePlatform(); PUBLIC_APP_NATIVE is a build-time override.
 */
export function isNativeApp(): boolean {
	if (!browser) return false;
	try {
		if (Capacitor.isNativePlatform()) return true;
	} catch {
		/* Capacitor not injected (web) */
	}
	return import.meta.env.PUBLIC_APP_NATIVE === '1' || import.meta.env.PUBLIC_APP_NATIVE === 'true';
}

/** Vercel Analytics / Speed Insights — web/PWA only, never native shell. */
export function isWebAnalyticsAvailable(): boolean {
	return webAnalyticsAvailable({ browser, native: isNativeApp() });
}

/** Absolute origin for web-only APIs (account delete) when the app is a static native shell. */
export function webApiOrigin(): string {
	return resolveWebApiOrigin({
		webOrigin: import.meta.env.PUBLIC_WEB_ORIGIN,
		siteUrl: import.meta.env.PUBLIC_SITE_URL,
		browserOrigin: browser && typeof window !== 'undefined' ? window.location?.origin : ''
	});
}
