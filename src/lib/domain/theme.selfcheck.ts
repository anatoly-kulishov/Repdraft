import {
	DEFAULT_APP_THEME,
	parseAppTheme,
	resolveInitialTheme
} from './theme.ts';

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

assert(parseAppTheme('dark') === 'dark', 'parse dark');
assert(parseAppTheme('light') === 'light', 'parse light');
assert(parseAppTheme('auto') === null, 'parse junk');
assert(parseAppTheme(null) === null, 'parse null');

assert(resolveInitialTheme('light', false) === 'light', 'stored light wins over OS dark');
assert(resolveInitialTheme('dark', true) === 'dark', 'stored dark wins over OS light');
assert(resolveInitialTheme(null, true) === 'light', 'empty + OS light');
assert(resolveInitialTheme(null, false) === 'dark', 'empty + OS dark');
assert(resolveInitialTheme(null, null) === DEFAULT_APP_THEME, 'empty + unknown OS → default');
assert(resolveInitialTheme('nope', true) === 'light', 'invalid stored + OS light');
assert(resolveInitialTheme('', false) === 'dark', 'empty string + OS dark');

console.log('theme.selfcheck: ok');
