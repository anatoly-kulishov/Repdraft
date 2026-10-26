/** Russian plural: pluralRu(23, ['тренировка', 'тренировки', 'тренировок']) → 'тренировки'. */
export function pluralRu(n: number, forms: readonly [string, string, string]): string {
	const abs = Math.abs(Math.trunc(n));
	const m10 = abs % 10;
	const m100 = abs % 100;
	if (m10 === 1 && m100 !== 11) return forms[0];
	if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
	return forms[2];
}
