import {
	dayKeyInInclusiveRange,
	dayKeyRangeRole,
	monthCalendarCells,
	normalizeDayRange,
	parseDayKey,
	shiftMonth
} from './calendar.ts';

const sep2026 = monthCalendarCells(2026, 8, { weekStartsOn: 1, maxDayKey: '2026-09-03' });
if (sep2026.length !== 42) throw new Error('month grid should be 6 weeks');
if (sep2026[0]?.dayKey !== '2026-08-31') throw new Error(`Monday-start Sep 2026 starts ${sep2026[0]?.dayKey}`);
const selected = sep2026.find((c) => c.dayKey === '2026-09-03');
if (!selected?.inMonth || selected.disabled) throw new Error('2026-09-03 should be enabled in-month');
const future = sep2026.find((c) => c.dayKey === '2026-09-04');
if (!future?.disabled) throw new Error('days after max should be disabled');

const shifted = shiftMonth(2026, 0, -1);
if (shifted.year !== 2025 || shifted.monthIndex !== 11) throw new Error('January -1 should be Dec 2025');

if (parseDayKey('2026-09-03')?.monthIndex !== 8) throw new Error('parseDayKey month');
if (parseDayKey('nope') !== null) throw new Error('invalid day key');

const swapped = normalizeDayRange('2026-09-05', '2026-09-02');
if (swapped.from !== '2026-09-02' || swapped.to !== '2026-09-05') {
	throw new Error('normalizeDayRange should swap');
}
if (!dayKeyInInclusiveRange('2026-09-03', '2026-09-02', '2026-09-05')) {
	throw new Error('inclusive mid should match');
}
if (dayKeyInInclusiveRange('2026-09-01', '2026-09-02', '2026-09-05')) {
	throw new Error('outside range should miss');
}
if (dayKeyRangeRole('2026-09-02', '2026-09-02', '2026-09-05') !== 'start') {
	throw new Error('range start role');
}
if (dayKeyRangeRole('2026-09-05', '2026-09-02', '2026-09-05') !== 'end') {
	throw new Error('range end role');
}
if (dayKeyRangeRole('2026-09-03', '2026-09-02', '2026-09-05') !== 'in-range') {
	throw new Error('in-range role');
}
if (dayKeyRangeRole('2026-09-03', '2026-09-03', '2026-09-03') !== 'single') {
	throw new Error('single-day role');
}
if (dayKeyRangeRole('2026-09-03', '2026-09-03', '') !== 'start') {
	throw new Error('draft start role');
}

console.log('calendar.selfcheck: ok');
