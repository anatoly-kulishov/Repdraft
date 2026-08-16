import assert from 'node:assert/strict';
import {
	isDesktopChromiumInstallSurface,
	isInstalledDisplayMode,
	isIosDevice,
	resolvePwaManualGuide
} from './pwaInstall.ts';

const safariIphone =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const chromeIos =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1';
const chromeDesktop =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

assert.equal(resolvePwaManualGuide({ ua: safariIphone }), 'ios-safari');
assert.equal(resolvePwaManualGuide({ ua: chromeIos }), 'ios-chrome');
assert.equal(resolvePwaManualGuide({ ua: chromeDesktop }), null);
assert.equal(resolvePwaManualGuide({ ua: safariIphone, hasChromiumRuntime: true }), null);
assert.equal(
	isDesktopChromiumInstallSurface({ hasChromiumRuntime: true, finePointerHover: true }),
	true
);
assert.equal(
	isDesktopChromiumInstallSurface({
		hasChromiumRuntime: true,
		finePointerHover: false,
		ua: chromeDesktop
	}),
	true
);
assert.equal(
	isDesktopChromiumInstallSurface({
		hasChromiumRuntime: true,
		finePointerHover: false,
		ua: safariIphone
	}),
	false
);
assert.equal(
	isInstalledDisplayMode((q) => q.includes('standalone')),
	true
);
assert.equal(isInstalledDisplayMode(() => false), false);
assert.equal(isInstalledDisplayMode(() => false, true), true);
assert.equal(
	isIosDevice({
		ua: chromeDesktop,
		platform: 'MacIntel',
		maxTouchPoints: 5,
		coarsePointer: true
	}),
	true
);

console.log('pwaInstall self-check ok');
