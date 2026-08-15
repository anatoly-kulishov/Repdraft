import { parseRestSoundEnabled } from './prefs.ts';

if (parseRestSoundEnabled(null) !== true) throw new Error('null rest sound defaults on');
if (parseRestSoundEnabled('1') !== true) throw new Error('1 enables rest sound');
if (parseRestSoundEnabled('0') !== false) throw new Error('0 disables rest sound');
if (parseRestSoundEnabled('false') !== false) throw new Error('false disables rest sound');

console.log('prefs self-check ok');
