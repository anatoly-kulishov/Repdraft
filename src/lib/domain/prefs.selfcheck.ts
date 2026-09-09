import {
	parseRestSoundEnabled,
	parseWebAnalyticsEnabled,
	REST_SOUND_STORAGE_KEY,
	WEB_ANALYTICS_STORAGE_KEY
} from './prefs.ts';

if (REST_SOUND_STORAGE_KEY !== 'repdraft:rest-sound') {
	throw new Error('REST_SOUND_STORAGE_KEY drift');
}
if (WEB_ANALYTICS_STORAGE_KEY !== 'repdraft:web-analytics') {
	throw new Error('WEB_ANALYTICS_STORAGE_KEY drift');
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

console.log('prefs self-check ok');
