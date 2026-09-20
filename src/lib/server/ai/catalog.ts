import type { ExerciseIndexItem } from '$lib/domain/types';
import catalogJson from '../../../../static/data/exercises.index.json';

const PROMPT_CAP = 70;

/** Full slim index (bundled for serverless; trust boundary whitelist). */
export function loadExerciseIndex(): ExerciseIndexItem[] {
	return catalogJson as ExerciseIndexItem[];
}

export function catalogWhitelist(index: ExerciseIndexItem[]): Set<string> {
	return new Set(index.map((x) => x.id));
}

type BodyHint = {
	parts: string[];
	equipment: string[];
};

/** Rough RU/EN keyword → catalog fields for prompt slimdown. */
export function hintsFromBrief(brief: string): BodyHint {
	const t = brief.toLowerCase();
	const parts: string[] = [];
	const equipment: string[] = [];

	// Hinge / deadlift family → legs (also may match «тяга»→back below; both OK).
	if (
		/румын|rdl|deadlift|мертв[а-яё]*\s*тяг|станова[а-яё]*\s*тяг|тяги?\s*на\s*прям/.test(t)
	) {
		parts.push('upper legs', 'lower legs');
	}

	const partRules: Array<[RegExp, string[]]> = [
		[/груд|chest|pec/, ['chest']],
		// «back» as word only (not feedback); «тяга» still maps pull/back days
		[/спин|\bbacks?\b|тяга|крыл/, ['back']],
		// «плеч» but not inside «предплечье»
		[/(?<!пред)плеч|shoulder|дельт/, ['shoulders']],
		[/трицеп|triceps/, ['upper arms']],
		[/бицеп|biceps|бицух|банк[аиу]/, ['upper arms']],
		[/рук[аиуеы]?|\barms?\b/, ['upper arms']],
		// «leg(s)» as word (not college); RU slang булки/галифе
		[/ног|\blegs?\b|квадр|ягод|glute|бедр|ляшк|галифе|булк/, ['upper legs', 'lower legs']],
		[/пресс|core|waist|абдом/, ['waist']],
		[/икр|\bcalf\b|\bcalves\b/, ['lower legs']],
		[/предплеч|forearm|wrist/, ['lower arms']],
		[/шея|neck/, ['neck']],
		[/кардио|cardio|бег/, ['cardio']],
		[/(?:^|[\s,])верх(?:\s+тела)?(?:$|[\s,])|\bupper\b/, ['chest', 'back', 'shoulders', 'upper arms']],
		[/(?:^|[\s,])низ(?:\s+тела)?(?:$|[\s,])|\blower\b/, ['upper legs', 'lower legs', 'waist']],
		[/вс[её]\s+тело|full\s*body|фулбади/, ['chest', 'back', 'shoulders', 'upper arms', 'upper legs', 'lower legs', 'waist']]
	];
	for (const [re, vals] of partRules) {
		if (re.test(t)) parts.push(...vals);
	}

	const eqRules: Array<[RegExp, string]> = [
		[/штан|barbell/, 'barbell'],
		[/гантел|dumbbell/, 'dumbbell'],
		[/кабел|cable|блок/, 'cable'],
		[/свой вес|body ?weight|без оборуд|собственн/, 'body weight'],
		[/тренаж|machine|lever/, 'leverage machine'],
		[/смит|smith/, 'smith machine'],
		[/гир|kettle/, 'kettlebell'],
		[/эспан|band/, 'band']
	];
	for (const [re, eq] of eqRules) {
		if (re.test(t)) equipment.push(eq);
	}

	return { parts: [...new Set(parts)], equipment: [...new Set(equipment)] };
}

export function popularity(ex: ExerciseIndexItem): number {
	return typeof ex.globalPopularity === 'number' ? ex.globalPopularity : 25;
}

function topPopular(index: ExerciseIndexItem[], cap = PROMPT_CAP): ExerciseIndexItem[] {
	return [...index].sort((a, b) => popularity(b) - popularity(a)).slice(0, cap);
}

const SLIM_MIN = 8;

/** Slim catalog for the LLM prompt; whitelist stays full-index.
 *  Zone briefs stay inside body_part (relax equipment, never OR foreign zones).
 *  Equipment-only briefs may OR; tiny zones may return < SLIM_MIN. */
export function slimCatalogForBrief(
	index: ExerciseIndexItem[],
	brief: string
): ExerciseIndexItem[] {
	if (!index.length) return [];

	const { parts, equipment } = hintsFromBrief(brief);

	if (!parts.length && !equipment.length) {
		return topPopular(index);
	}

	const byParts = () =>
		parts.length ? index.filter((ex) => parts.includes(ex.body_part)) : [];

	const matchAnd = () =>
		index.filter((ex) => {
			const partOk = !parts.length || parts.includes(ex.body_part);
			const eqOk =
				!equipment.length ||
				equipment.some((eq) => ex.equipment.toLowerCase().includes(eq.toLowerCase()));
			return partOk && eqOk;
		});

	let matches = matchAnd();
	if (matches.length < SLIM_MIN && parts.length) {
		// Keep zone; drop equipment constraint (never pull foreign body_parts via OR).
		matches = byParts();
	} else if (matches.length < SLIM_MIN && equipment.length && !parts.length) {
		matches = index.filter((ex) =>
			equipment.some((eq) => ex.equipment.toLowerCase().includes(eq.toLowerCase()))
		);
	}
	if (matches.length < SLIM_MIN && !parts.length) {
		return topPopular(index);
	}
	if (!matches.length) {
		return parts.length ? byParts() : topPopular(index);
	}

	// Group by body part, sort each by popularity, then interleave round-robin
	// so a brief like "back and biceps" gets both zones represented at the top.
	const byPart = new Map<string, ExerciseIndexItem[]>();
	for (const ex of matches) {
		const list = byPart.get(ex.body_part) ?? [];
		list.push(ex);
		byPart.set(ex.body_part, list);
	}
	for (const list of byPart.values()) {
		list.sort((a, b) => popularity(b) - popularity(a));
	}

	const interleaved: ExerciseIndexItem[] = [];
	const queues = [...byPart.values()];
	let added = true;
	while (added && interleaved.length < PROMPT_CAP) {
		added = false;
		for (const q of queues) {
			if (!q.length) continue;
			interleaved.push(q.shift()!);
			added = true;
			if (interleaved.length >= PROMPT_CAP) break;
		}
	}
	return interleaved.length
		? interleaved
		: [...matches].sort((a, b) => popularity(b) - popularity(a)).slice(0, PROMPT_CAP);
}

export function catalogPromptLines(items: ExerciseIndexItem[]): string {
	return items
		.map((x) => {
			const title = x.name_ru || x.name;
			return `- ${x.id}: ${title} | ${x.body_part} | ${x.equipment} | ${x.target}`;
		})
		.join('\n');
}
