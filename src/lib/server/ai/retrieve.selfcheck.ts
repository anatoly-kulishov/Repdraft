/**
 * RAG retrieve + split template evals.
 *
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/server/ai/retrieve.selfcheck.ts
 */
import { hintsFromBrief, loadExerciseIndex, slimCatalogForBrief } from './catalog.ts';
import { cosine, loadEmbeddingIndex } from './embeddings.ts';
import { retrieve, retrieveRegexOnly } from './retrieve.ts';
import { matchTemplate } from './splitTemplates.ts';

type Attack = { id: string; run: () => void | Promise<void> };
const attacks: Attack[] = [];

function attack(id: string, run: () => void | Promise<void>) {
	attacks.push({ id, run });
}

const index = loadExerciseIndex();

function assertNoLeak(
	brief: string,
	exercises: { body_part: string; target: string; id: string }[],
	forbiddenParts: string[],
	forbiddenTargets: string[] = []
) {
	const leaked = exercises.filter(
		(ex) =>
			forbiddenParts.includes(ex.body_part) || forbiddenTargets.includes(ex.target)
	);
	if (leaked.length) {
		throw new Error(
			`${brief}: leaked ${leaked
				.slice(0, 5)
				.map((e) => `${e.id}:${e.body_part}/${e.target}`)
				.join(', ')}`
		);
	}
}

attack('cosine.self', () => {
	const a = [1, 0, 0];
	const b = [1, 0, 0];
	const c = [0, 1, 0];
	if (Math.abs(cosine(a, b) - 1) > 1e-9) throw new Error(`identical ${cosine(a, b)}`);
	if (Math.abs(cosine(a, c)) > 1e-9) throw new Error(`orthogonal ${cosine(a, c)}`);
});

attack('hints.slang-banks', () => {
	const h = hintsFromBrief('хочу накачать банки');
	if (!h.parts.includes('upper arms')) {
		throw new Error(`expected upper arms, got ${JSON.stringify(h.parts)}`);
	}
});

attack('hints.slang-galife', () => {
	const h = hintsFromBrief('убрать галифе');
	if (!h.parts.includes('upper legs')) {
		throw new Error(`expected upper legs, got ${JSON.stringify(h.parts)}`);
	}
});

attack('template.arms', () => {
	const t = matchTemplate(['upper arms'], ['upper arms']);
	if (t?.id !== 'arms') throw new Error(`expected arms, got ${t?.id}`);
});

attack('template.push-from-hints', () => {
	const t = matchTemplate(['chest', 'upper arms', 'chest'], ['chest', 'upper arms']);
	if (t?.id !== 'push' && t?.id !== 'chest') {
		throw new Error(`expected push|chest, got ${t?.id}`);
	}
});

attack('template.pull', () => {
	const t = matchTemplate(['back', 'back', 'upper arms'], ['back', 'upper arms']);
	if (t?.id !== 'pull' && t?.id !== 'back') {
		throw new Error(`expected pull|back, got ${t?.id}`);
	}
});

attack('regex.arms-no-legs', () => {
	const slim = slimCatalogForBrief(index, 'Хочу руки подкачать');
	assertNoLeak('руки', slim, ['upper legs'], ['glutes']);
	const r = retrieveRegexOnly('Хочу руки подкачать', index);
	if (r.template?.id !== 'arms') {
		throw new Error(`template want arms got ${r.template?.id}`);
	}
});

attack('regex.chest-triceps-template', () => {
	const r = retrieveRegexOnly('грудь и трицепс, 45 минут', index);
	if (!r.template || !['push', 'chest'].includes(r.template.id)) {
		throw new Error(`want push|chest got ${r.template?.id}`);
	}
	assertNoLeak('грудь+три', r.exercises, ['upper legs'], ['glutes']);
});

const BRIEF_CASES: Array<{
	brief: string;
	forbidParts: string[];
	forbidTargets?: string[];
	templateIds?: string[];
}> = [
	{ brief: 'банки', forbidParts: ['upper legs'], forbidTargets: ['glutes'], templateIds: ['arms'] },
	{ brief: 'галифе', forbidParts: ['upper arms', 'chest'], templateIds: ['legs', 'lower'] },
	{ brief: 'памп груди', forbidParts: ['upper legs'], forbidTargets: ['glutes'], templateIds: ['chest', 'push'] },
	{ brief: 'спина шире', forbidParts: ['upper legs'], forbidTargets: ['glutes'], templateIds: ['back', 'pull'] },
	{ brief: 'руки', forbidParts: ['upper legs'], forbidTargets: ['glutes'], templateIds: ['arms'] },
	{ brief: 'ноги 60 минут', forbidParts: ['chest', 'back'], templateIds: ['legs', 'lower'] },
	{ brief: 'плечи гантели', forbidParts: ['upper legs'], templateIds: ['shoulders'] },
	{ brief: 'пресс', forbidParts: ['upper legs', 'chest'], templateIds: ['core'] },
	{ brief: 'верх тела', forbidParts: [], templateIds: ['upper', 'push', 'pull'] },
	{ brief: 'низ тела', forbidParts: ['chest', 'back'], templateIds: ['lower', 'legs'] },
	{ brief: 'всё тело', forbidParts: [], templateIds: ['fullbody', 'upper', 'lower'] },
	{
		brief: 'грудь и трицепс штанга',
		forbidParts: ['upper legs'],
		forbidTargets: ['glutes'],
		templateIds: ['push', 'chest']
	},
	{
		brief: 'спина и бицепс',
		forbidParts: ['upper legs'],
		forbidTargets: ['glutes'],
		templateIds: ['pull', 'back']
	},
	{ brief: 'pump arms', forbidParts: ['upper legs'], forbidTargets: ['glutes'], templateIds: ['arms'] },
	{ brief: 'chest pump', forbidParts: ['upper legs'], templateIds: ['chest', 'push'] },
	{ brief: 'хочу руки подкачать', forbidParts: ['upper legs'], forbidTargets: ['glutes'], templateIds: ['arms'] }
];

for (const c of BRIEF_CASES) {
	attack(`regex.case:${c.brief.slice(0, 24)}`, () => {
		const r = retrieveRegexOnly(c.brief, index);
		if (c.forbidParts.length || c.forbidTargets?.length) {
			assertNoLeak(c.brief, r.exercises, c.forbidParts, c.forbidTargets ?? []);
		}
		if (c.templateIds?.length) {
			if (!r.template || !c.templateIds.includes(r.template.id)) {
				throw new Error(`template ${r.template?.id} not in ${c.templateIds.join('|')}`);
			}
		}
		if (r.exercises.length < 5) {
			throw new Error(`too few exercises: ${r.exercises.length}`);
		}
	});
}

attack('hybrid.live-or-skip', async () => {
	const emb = loadEmbeddingIndex();
	if (!emb?.items?.length) {
		console.log('SKIP hybrid.live (empty embeddings index)');
		return;
	}
	const r = await retrieve('хочу накачать банки', index);
	if (r.mode === 'hybrid') {
		assertNoLeak('банки-hybrid', r.exercises.slice(0, 20), ['upper legs'], ['glutes']);
	}
	const armsShare =
		r.exercises.slice(0, 15).filter((e) => e.body_part === 'upper arms').length / 15;
	if (armsShare < 0.4) {
		throw new Error(`arms share too low in top-15: ${armsShare}`);
	}
});

attack('hybrid.not-worse-than-regex-arms', async () => {
	const emb = loadEmbeddingIndex();
	if (!emb?.items?.length) {
		console.log('SKIP hybrid.not-worse (empty embeddings index)');
		return;
	}
	const brief = 'Хочу руки подкачать';
	const regex = retrieveRegexOnly(brief, index);
	const hybrid = await retrieve(brief, index);
	const regexLeak = regex.exercises.filter((e) => e.body_part === 'upper legs').length;
	const hybridLeak = hybrid.exercises.filter((e) => e.body_part === 'upper legs').length;
	if (hybridLeak > regexLeak) {
		throw new Error(`hybrid leaked more legs (${hybridLeak} > ${regexLeak})`);
	}
});

let failed = 0;
const failing: string[] = [];
for (const a of attacks) {
	try {
		await a.run();
		console.log(`PASS ${a.id}`);
	} catch (err) {
		failed += 1;
		failing.push(a.id);
		console.error(`FAIL ${a.id}: ${(err as Error).message}`);
	}
}

if (failed > 0) {
	console.error(`\nretrieve: ${failed}/${attacks.length} failing`);
	console.error(failing.join('\n'));
	process.exit(1);
}
console.log(`\nretrieve: ${attacks.length}/${attacks.length} passing`);
