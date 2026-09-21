import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Exercise } from './types';

type InstructionOverrides = Record<string, string[]>;

export function runExerciseInstructionsSelfCheck(): void {
	const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
	const overrides = JSON.parse(
		readFileSync(join(root, 'static/data/exercise-instructions.ru.overrides.json'), 'utf8')
	) as InstructionOverrides;
	const catalog = JSON.parse(
		readFileSync(join(root, 'static/data/exercises.full.json'), 'utf8')
	) as Exercise[];
	const byId = new Map(catalog.map((ex) => [ex.id, ex]));

	if (Object.keys(overrides).length < 80) {
		throw new Error(
			`expected curated RU instruction overrides for core Delavier/powermens moves, got ${Object.keys(overrides).length}`
		);
	}

	for (const [id, steps] of Object.entries(overrides)) {
		if (!Array.isArray(steps) || steps.length < 3) {
			throw new Error(`${id}: override must have at least 3 RU steps`);
		}
		const ex = byId.get(id);
		if (!ex) throw new Error(`${id}: missing from exercises.full.json`);
		const baked = ex.instruction_steps?.ru ?? [];
		if (baked.length !== steps.length || baked.some((s, i) => s !== steps[i])) {
			throw new Error(`${id}: catalog instruction_steps.ru out of sync with overrides`);
		}
		const blob = steps.join(' ');
		if (/[A-Za-z]{4,}/.test(blob)) {
			throw new Error(`${id}: RU steps still contain long Latin tokens`);
		}
		if (/\bкнизу\b/i.test(blob)) {
			throw new Error(`${id}: use spaced «к низу», not «книзу»`);
		}
		if (/[—–]/.test(blob)) {
			throw new Error(`${id}: RU steps must not use em/en dash punctuation`);
		}
	}

	const jm = overrides['0052'];
	if (!jm) throw new Error('0052 JM-жим must have curated RU steps');
	const jmText = jm.join(' ').toLowerCase();
	if (!jmText.includes('верхн') && !jmText.includes('ше')) {
		throw new Error('JM press must mention upper chest / neck path, not a plain bench press');
	}
	if (jmText.includes('к груди, держа локти близко') || jmText.includes('чуть шире плеч')) {
		throw new Error('JM press must not reuse the generic bench-press copy');
	}

	const bench = overrides['0025'];
	if (!bench) throw new Error('0025 bench press must use powermens/Delavier technique');
	const benchText = bench.join(' ').toLowerCase();
	if (!benchText.includes('нижн')) {
		throw new Error('bench press technique should lower the bar to the lower chest (Delavier)');
	}

	let withEn = 0;
	let withRu = 0;
	for (const ex of catalog) {
		const en = (ex.instruction_steps?.en ?? []).filter((s) => String(s).trim());
		if (en.length < 2) continue;
		withEn += 1;
		const ru = (ex.instruction_steps?.ru ?? []).filter((s) => String(s).trim());
		if (ru.length >= 2) withRu += 1;
		else throw new Error(`${ex.id}: missing baked RU instruction steps`);
		const blob = ru.join(' ');
		if (/[—–]/.test(blob)) {
			throw new Error(`${ex.id}: baked RU must not use em/en dash`);
		}
	}
	if (withRu < withEn) {
		throw new Error(`RU instruction coverage incomplete: ${withRu}/${withEn}`);
	}

	const alignment: Array<{ id: string; must: RegExp; mustNot: RegExp; why: string }> = [
		{ id: '0277', must: /наклонн|отрицательн|вниз/i, mustNot: /римск/i, why: 'decline crunch ≠ Roman chair' },
		{ id: '0078', must: /штанг|гриф/i, mustNot: /смит/i, why: 'barbell rear lunge ≠ Smith' },
		{ id: '0077', must: /шаг|выпад/i, mustNot: /сядьте на скам/i, why: 'rear lunge is standing' },
		{ id: '1378', must: /стен/i, mustNot: /капитанск/i, why: 'calf stretch ≠ captain chair' },
		{ id: '0544', must: /гир/i, mustNot: /сядьте на скам/i, why: 'pistol squat is standing' },
		{ id: '0850', must: /фитбол|мяч/i, mustNot: /^Встаньте/, why: 'side bend on ball starts seated' },
		{ id: '0091', must: /сяд/i, mustNot: /касается бед/i, why: 'seated press ≠ standing press' },
		{ id: '1409', must: /ляж|спин/i, mustNot: /верх спины на краю/i, why: 'glute bridge is on the floor' },
		{ id: '0985', must: /высок|над голов/i, mustNot: /на уровне талии/i, why: 'kneeling crunch uses a high anchor' },
		{ id: '0150', must: /верхн|вниз/i, mustNot: /горизонтальной тяги/i, why: 'lat pulldown ≠ seated row machine' }
	];
	for (const rule of alignment) {
		const ex = byId.get(rule.id);
		const blob = (ex?.instruction_steps?.ru ?? []).join(' ');
		if (!rule.must.test(blob) || rule.mustNot.test(blob)) {
			throw new Error(`${rule.id}: ${rule.why}`);
		}
	}

	for (const ex of catalog) {
		const name = (ex.name ?? '').toLowerCase();
		if (!name.includes('dumbbell') || name.includes('kettlebell')) continue;
		const blob = (ex.instruction_steps?.ru ?? []).join(' ');
		if (/\bгир[яеюиях]\b/.test(blob) && !/гантел/.test(blob)) {
			throw new Error(`${ex.id}: dumbbell exercise RU must not say only «гиря»`);
		}
	}
}

runExerciseInstructionsSelfCheck();
console.log('exerciseInstructions self-check ok');
