/**
 * Standalone cascade invariants (no TS path aliases / extensionless imports).
 * Run: node --experimental-strip-types ./src/lib/domain/filters.selfcheck.ts
 */
type Item = { body_part: string; equipment: string; target: string };

function availableTargets(items: Item[], bodyPart: string, equipment: string): string[] {
	const pool = items.filter((i) => {
		if (bodyPart !== 'all' && i.body_part !== bodyPart) return false;
		if (equipment !== 'all' && i.equipment !== equipment) return false;
		return true;
	});
	return [...new Set(pool.map((i) => i.target))];
}

function isConflict(items: Item[], bodyPart: string, target: string): boolean {
	if (bodyPart === 'all' || target === 'all') return false;
	const both = items.filter((i) => i.body_part === bodyPart && i.target === target);
	if (both.length > 0) return false;
	const bodyOnly = items.some((i) => i.body_part === bodyPart);
	const targetOnly = items.some((i) => i.target === target);
	return bodyOnly && targetOnly;
}

const catalog: Item[] = [
	{ body_part: 'upper legs', equipment: 'band', target: 'quads' },
	{ body_part: 'chest', equipment: 'band', target: 'pectorals' },
	{ body_part: 'upper legs', equipment: 'barbell', target: 'glutes' }
];

const targets = availableTargets(catalog, 'upper legs', 'all');
if (targets.includes('pectorals')) throw new Error('pectorals must not appear under upper legs');
if (!targets.includes('quads') || !targets.includes('glutes')) {
	throw new Error(`expected quads/glutes, got ${targets.join(',')}`);
}
if (!isConflict(catalog, 'upper legs', 'pectorals')) {
	throw new Error('legs + pectorals should conflict');
}
if (isConflict(catalog, 'upper legs', 'quads')) {
	throw new Error('legs + quads must not conflict');
}

console.log('filters cascade self-check ok');
