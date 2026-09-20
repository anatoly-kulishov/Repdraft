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

	const partRules: Array<[RegExp, string[]]> = [
		[/груд|chest|pec/, ['chest']],
		[/спин|back(?!ward)|тяга/, ['back']],
		[/плеч|shoulder|дельт/, ['shoulders']],
		[/трицеп|triceps/, ['upper arms']],
		[/бицеп|biceps/, ['upper arms']],
		// «руки» / arms — без этого brief вроде «хочу руки» уходит в topPopular (присед и т.д.)
		[/рук[аиуеы]?|\barms?\b/, ['upper arms']],
		[/ног|leg|квадр|ягод|glute|бедр/, ['upper legs', 'lower legs']],
		[/пресс|core|waist|абдом/, ['waist']],
		[/икр|calf/, ['lower legs']],
		[/предплеч|forearm|wrist/, ['lower arms']],
		[/шея|neck/, ['neck']],
		[/кардио|cardio|бег/, ['cardio']],
		// Upper / lower / full-body templates (avoid matching bare "тело" alone)
		[/(?:^|[\s,])верх(?:\s+тела)?(?:$|[\s,])|upper/, ['chest', 'back', 'shoulders', 'upper arms']],
		[/(?:^|[\s,])низ(?:\s+тела)?(?:$|[\s,])|lower/, ['upper legs', 'lower legs', 'waist']],
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

function popularity(ex: ExerciseIndexItem): number {
	return typeof ex.globalPopularity === 'number' ? ex.globalPopularity : 25;
}

function topPopular(index: ExerciseIndexItem[], cap = PROMPT_CAP): ExerciseIndexItem[] {
	return [...index].sort((a, b) => popularity(b) - popularity(a)).slice(0, cap);
}

const SLIM_MIN = 8;

/** Slim catalog for the LLM prompt; whitelist stays full-index.
 *  Interleaves by requested body part so neither zone dominates by popularity.
 *  Never returns empty when the index has items (AND → OR → popular fallback). */
export function slimCatalogForBrief(
	index: ExerciseIndexItem[],
	brief: string
): ExerciseIndexItem[] {
	if (!index.length) return [];

	const { parts, equipment } = hintsFromBrief(brief);

	if (!parts.length && !equipment.length) {
		return topPopular(index);
	}

	const match = (mode: 'and' | 'or') =>
		index.filter((ex) => {
			const partOk = !parts.length || parts.includes(ex.body_part);
			const eqOk =
				!equipment.length ||
				equipment.some((eq) => ex.equipment.toLowerCase().includes(eq.toLowerCase()));
			return mode === 'and' ? partOk && eqOk : partOk || eqOk;
		});

	let matches = match('and');
	if (matches.length < SLIM_MIN) matches = match('or');
	if (matches.length < SLIM_MIN) return topPopular(index);

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
	return interleaved.length >= SLIM_MIN
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
