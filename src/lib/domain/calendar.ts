export type CalendarCell = {
	dayKey: string;
	inMonth: boolean;
	disabled: boolean;
};

export type DayRangeRole = 'none' | 'start' | 'end' | 'single' | 'in-range';

function localDayKey(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function parseDayKey(dayKey: string): { year: number; monthIndex: number; day: number } | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
	if (!m) return null;
	const year = Number(m[1]);
	const monthIndex = Number(m[2]) - 1;
	const day = Number(m[3]);
	if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) return null;
	if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
	return { year, monthIndex, day };
}

export function shiftMonth(
	year: number,
	monthIndex: number,
	delta: number
): { year: number; monthIndex: number } {
	const next = monthIndex + delta;
	const yearDelta = Math.floor(next / 12);
	let month = next % 12;
	if (month < 0) month += 12;
	return { year: year + yearDelta, monthIndex: month };
}

export function monthCalendarCells(
	year: number,
	monthIndex: number,
	opts: { weekStartsOn: 0 | 1; maxDayKey?: string }
): CalendarCell[] {
	const first = new Date(year, monthIndex, 1);
	const startOffset = (first.getDay() - opts.weekStartsOn + 7) % 7;
	const gridStart = new Date(year, monthIndex, 1 - startOffset);
	const maxKey = opts.maxDayKey ?? '';
	const cells: CalendarCell[] = [];
	for (let i = 0; i < 42; i += 1) {
		const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
		const dayKey = localDayKey(date);
		cells.push({
			dayKey,
			inMonth: date.getMonth() === monthIndex,
			disabled: maxKey !== '' && dayKey > maxKey
		});
	}
	return cells;
}

/** Lexicographic YYYY-MM-DD order; swap when end is before start. */
export function normalizeDayRange(from: string, to: string): { from: string; to: string } {
	if (!from) return { from: '', to: '' };
	if (!to) return { from, to: from };
	return from <= to ? { from, to } : { from: to, to: from };
}

export function dayKeyInInclusiveRange(dayKey: string, from: string, to: string): boolean {
	if (!dayKey || !from) return false;
	const range = normalizeDayRange(from, to || from);
	return dayKey >= range.from && dayKey <= range.to;
}

/** Visual role for a calendar cell while drafting or applying a range. */
export function dayKeyRangeRole(dayKey: string, from: string, to: string): DayRangeRole {
	if (!dayKey || !from) return 'none';
	if (!to) return dayKey === from ? 'start' : 'none';
	const range = normalizeDayRange(from, to);
	if (range.from === range.to) return dayKey === range.from ? 'single' : 'none';
	if (dayKey === range.from) return 'start';
	if (dayKey === range.to) return 'end';
	if (dayKey > range.from && dayKey < range.to) return 'in-range';
	return 'none';
}
