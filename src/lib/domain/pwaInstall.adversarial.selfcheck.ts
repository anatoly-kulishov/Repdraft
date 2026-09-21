/**
 * Adversarial PWA install tip — hostile asserts that FAIL against current code.
 *
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/domain/pwaInstall.adversarial.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
	isDesktopChromiumInstallSurface,
	isIosDevice,
	needsChromiumMobileInstallGuide,
	resolvePwaManualGuide,
	type PwaManualGuide
} from './pwaInstall.ts';

type InstallMode = 'prompt' | 'desktop' | 'android-chrome' | PwaManualGuide;

const safariIphone =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
/** iPadOS 13+ Safari default desktop UA (no iPad token). */
const safariIpadDesktopUa =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
/** Chrome-on-iPad "Request Desktop Website" style UA (Chrome/, no CriOS/Mobile). */
const chromeIpadDesktopUa =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const chromeAndroid =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

/**
 * Mirrors PwaInstallHint reveal path (after installed/dismiss/BIP gates).
 * mode = manual ?? (androidChrome ? 'android-chrome' : 'desktop')
 */
function resolveRevealMode(input: {
	ua: string;
	platform?: string;
	maxTouchPoints?: number;
	coarsePointer?: boolean;
	hasChromiumRuntime: boolean;
	finePointerHover: boolean;
}): InstallMode | null {
	const manual = resolvePwaManualGuide({
		ua: input.ua,
		platform: input.platform,
		maxTouchPoints: input.maxTouchPoints,
		coarsePointer: input.coarsePointer,
		hasChromiumRuntime: input.hasChromiumRuntime
	});
	const desktop =
		!manual &&
		isDesktopChromiumInstallSurface({
			hasChromiumRuntime: input.hasChromiumRuntime,
			finePointerHover: input.finePointerHover,
			ua: input.ua
		});
	const androidChrome =
		!manual &&
		!desktop &&
		needsChromiumMobileInstallGuide({
			hasChromiumRuntime: input.hasChromiumRuntime,
			ua: input.ua
		});
	if (!manual && !desktop && !androidChrome) return null;
	return manual ?? (androidChrome ? 'android-chrome' : 'desktop');
}

/** Full tip visibility + mode (pure gates mirroring onMount). */
function resolveTipMode(input: {
	installedDisplay: boolean;
	dismissed: boolean;
	installedPref: boolean;
	relatedAppsApi: 'unavailable' | 'empty' | 'webapp';
	hasBip: boolean;
	ua: string;
	platform?: string;
	maxTouchPoints?: number;
	coarsePointer?: boolean;
	hasChromiumRuntime: boolean;
	finePointerHover: boolean;
}): InstallMode | null {
	if (input.installedDisplay) return null;
	if (input.dismissed) return null;
	if (input.relatedAppsApi === 'webapp') return null;
	// relatedApps unavailable: do not hide on stale installedPref (browser tab).
	if (input.hasBip) return 'prompt';
	return resolveRevealMode(input);
}

/** Mirrors app.html capture + takeCapturedBip peek (do not clear on remount). */
function takeCapturedBip(host: { bip: object | null }): object | null {
	return host.bip;
}

const failures: string[] = [];

function attack(name: string, fn: () => void): void {
	try {
		fn();
		console.log(`PASS (not broken): ${name}`);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		failures.push(`${name} :: ${msg}`);
		console.error(`FAIL: ${name}\n  ${msg}`);
	}
}

attack('ipad.safari-desktop-ua-fine-pointer-still-manual', () => {
	// iPadOS + Magic Keyboard / mouse: (pointer: coarse) is often false, but device is still iPad.
	const guide = resolvePwaManualGuide({
		ua: safariIpadDesktopUa,
		platform: 'MacIntel',
		maxTouchPoints: 5,
		coarsePointer: false,
		hasChromiumRuntime: false
	});
	assert.equal(
		guide,
		'ios-safari',
		`iPad Safari desktop UA with fine pointer must still get ios-safari, got ${JSON.stringify(guide)}`
	);
	assert.equal(
		isIosDevice({
			ua: safariIpadDesktopUa,
			platform: 'MacIntel',
			maxTouchPoints: 5,
			coarsePointer: false
		}),
		true,
		'isIosDevice must treat multi-touch MacIntel iPadOS as iOS even without coarse pointer'
	);
});

attack('ipad.chrome-desktop-ua-must-not-be-desktop-guide', () => {
	// Chrome/Desktop UA on iPad (no CriOS) must not land on desktop Chromium menu steps.
	const mode = resolveRevealMode({
		ua: chromeIpadDesktopUa,
		platform: 'MacIntel',
		maxTouchPoints: 5,
		coarsePointer: true,
		hasChromiumRuntime: false,
		finePointerHover: false
	});
	assert.notEqual(
		mode,
		'desktop',
		`iPad Chrome desktop UA must not show desktop install steps, got ${JSON.stringify(mode)}`
	);
	assert.ok(
		mode === 'ios-chrome' || mode === 'ios-safari' || mode === 'android-chrome',
		`expected an iOS/mobile guide, got ${JSON.stringify(mode)}`
	);
});

attack('bip.remount-after-consume-keeps-prompt', () => {
	// Home-only mount destroys hint on navigate away; peek must keep BIP for remount.
	// Browser will not re-fire beforeinstallprompt.
	const host: { bip: object | null } = { bip: { prompt: true } };
	const first = takeCapturedBip(host);
	assert.ok(first, 'first mount must see captured BIP');
	const second = takeCapturedBip(host);
	assert.ok(second, 'second mount must still see captured BIP (peek, not consume)');

	const afterRemount = resolveTipMode({
		installedDisplay: false,
		dismissed: false,
		installedPref: false,
		relatedAppsApi: 'empty',
		hasBip: second !== null,
		ua: chromeAndroid,
		hasChromiumRuntime: true,
		finePointerHover: false
	});
	assert.equal(
		afterRemount,
		'prompt',
		`BIP was available this page load; remount must keep prompt, got ${JSON.stringify(afterRemount)}`
	);
});

attack('installed.pref-stale-when-related-apps-unavailable', () => {
	// iOS Safari: getInstalledRelatedApps undefined. Stale pwa-installed pref must not hide tip forever
	// when display-mode is browser (user uninstalled / not in the installed shell).
	const mode = resolveTipMode({
		installedDisplay: false,
		dismissed: false,
		installedPref: true,
		relatedAppsApi: 'unavailable',
		hasBip: false,
		ua: safariIphone,
		hasChromiumRuntime: false,
		finePointerHover: false
	});
	assert.equal(
		mode,
		'ios-safari',
		`stale installed pref + no related-apps API must not hide browser-tab tip, got ${JSON.stringify(mode)}`
	);
});

if (failures.length === 0) {
	console.log('pwaInstall.adversarial.selfcheck: zero failing attacks');
	process.exit(0);
}

console.error(`\npwaInstall.adversarial.selfcheck: ${failures.length} break(s)`);
for (const f of failures) console.error(` - ${f}`);
process.exit(1);
