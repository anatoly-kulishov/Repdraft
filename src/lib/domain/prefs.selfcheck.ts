import {
	parseRestSoundEnabled,
	parseTesterModeEnabled,
	parseWebAnalyticsEnabled,
	REST_SOUND_STORAGE_KEY,
	TESTER_MODE_STORAGE_KEY,
	TESTER_MODE_UNLOCK_TAPS,
	testerToolsVisible,
	WEB_ANALYTICS_STORAGE_KEY
} from './prefs.ts';

if (REST_SOUND_STORAGE_KEY !== 'repdraft:rest-sound') {
	throw new Error('REST_SOUND_STORAGE_KEY drift');
}
if (WEB_ANALYTICS_STORAGE_KEY !== 'repdraft:web-analytics') {
	throw new Error('WEB_ANALYTICS_STORAGE_KEY drift');
}
if (TESTER_MODE_STORAGE_KEY !== 'repdraft:tester-mode') {
	throw new Error('TESTER_MODE_STORAGE_KEY drift');
}
if (TESTER_MODE_UNLOCK_TAPS !== 7) {
	throw new Error('TESTER_MODE_UNLOCK_TAPS drift');
}

if (parseRestSoundEnabled(null) !== true) throw new Error('null rest sound defaults on');
if (parseRestSoundEnabled('1') !== true) throw new Error('1 enables rest sound');
if (parseRestSoundEnabled('0') !== false) throw new Error('0 disables rest sound');
if (parseRestSoundEnabled('false') !== false) throw new Error('false disables rest sound');

if (parseWebAnalyticsEnabled(null) !== false) throw new Error('web analytics defaults off');
if (parseWebAnalyticsEnabled(undefined) !== false) throw new Error('undefined analytics off');
if (parseWebAnalyticsEnabled('') !== false) throw new Error('empty analytics off');
if (parseWebAnalyticsEnabled('false') !== false) throw new Error('false string analytics off');
if (parseWebAnalyticsEnabled('garbage') !== false) throw new Error('garbage analytics off');
if (parseWebAnalyticsEnabled('1') !== true) throw new Error('1 enables web analytics');
if (parseWebAnalyticsEnabled('true') !== true) throw new Error('true enables web analytics');
if (parseWebAnalyticsEnabled('0') !== false) throw new Error('0 disables web analytics');

if (parseTesterModeEnabled(null) !== false) throw new Error('tester mode defaults off');
if (parseTesterModeEnabled('1') !== true) throw new Error('1 enables tester mode');
if (parseTesterModeEnabled('0') !== false) throw new Error('0 disables tester mode');
if (testerToolsVisible({ pref: false, dev: false }) !== false) {
	throw new Error('prod without pref hides tester tools');
}
if (testerToolsVisible({ pref: true, dev: false }) !== true) {
	throw new Error('pref shows tester tools');
}
if (testerToolsVisible({ pref: false, dev: true }) !== true) {
	throw new Error('dev shows tester tools');
}

console.log('prefs self-check ok');
