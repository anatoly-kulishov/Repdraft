/** When the browser cannot fire `beforeinstallprompt`, guide the user manually. */

export type PwaManualGuide = 'ios-safari' | 'ios-chrome';

export function isIosDevice(input: {
	ua: string;
	platform?: string;
	maxTouchPoints?: number;
	coarsePointer?: boolean;
}): boolean {
	if (/iPhone|iPad|iPod/i.test(input.ua)) return true;
	// iPadOS 13+ desktop UA — require coarse pointer so Mac desktops stay out.
	return (
		input.platform === 'MacIntel' &&
		(input.maxTouchPoints ?? 0) > 1 &&
		input.coarsePointer === true
	);
}

/** Chrome/Edge on desktop — Install via BIP or menu fallback (not phone Chrome). */
export function isDesktopChromiumInstallSurface(input: {
	hasChromiumRuntime: boolean;
	/** `(hover: hover) and (pointer: fine)` — preferred desktop signal. */
	finePointerHover: boolean;
	ua?: string;
}): boolean {
	const ua = input.ua ?? '';
	const chromiumUa = /(?:Chrome|Chromium|Edg)\//i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
	if (!input.hasChromiumRuntime && !chromiumUa) return false;
	// Phones (incl. Chrome Android / DevTools mobile UA) use BIP or iOS guides instead.
	if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return false;
	return input.finePointerHover || chromiumUa || input.hasChromiumRuntime;
}

const INSTALLED_DISPLAY_MODES = [
	'standalone',
	'fullscreen',
	'minimal-ui',
	'window-controls-overlay'
] as const;

/** True when the page runs inside an installed PWA window (not a normal browser tab). */
export function isInstalledDisplayMode(
	matches: (query: string) => boolean,
	iosStandalone = false
): boolean {
	if (iosStandalone) return true;
	return INSTALLED_DISPLAY_MODES.some((mode) => matches(`(display-mode: ${mode})`));
}

/**
 * Manual Share / Home Screen tips are only for real iOS browsers.
 * Desktop Chromium (incl. Chrome DevTools with an iPhone UA) must not get them —
 * `window.chrome` is present there; Chrome on iOS does not expose it.
 * Also treat desktop Chrome UA as chromium even when `window.chrome` is missing (headless).
 */
export function resolvePwaManualGuide(input: {
	ua: string;
	platform?: string;
	maxTouchPoints?: number;
	coarsePointer?: boolean;
	/** True when `window.chrome` exists (desktop/Android Chromium runtime). */
	hasChromiumRuntime?: boolean;
}): PwaManualGuide | null {
	const chromiumDesktopUa =
		/(?:Chrome|Chromium|Edg)\//i.test(input.ua) &&
		!/CriOS|FxiOS|EdgiOS|Android|iPhone|iPad|iPod|Mobile/i.test(input.ua);
	if (input.hasChromiumRuntime || chromiumDesktopUa) return null;
	if (!isIosDevice(input)) return null;
	const { ua } = input;
	if (/CriOS/i.test(ua)) return 'ios-chrome';
	if (/FxiOS|EdgiOS|OPiOS/i.test(ua)) return null;
	if (/Safari/i.test(ua) && !/Chrome\//i.test(ua) && !/Chromium\//i.test(ua)) {
		return 'ios-safari';
	}
	return null;
}
