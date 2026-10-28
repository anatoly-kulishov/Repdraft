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

/** Hinge / deadlift family → legs (also may match «тяга»→back below; both OK). */
const HINGE_PART_RULE: [RegExp, string[]] = [
	/румын|rdl|deadlift|мертв[а-яё]*\s*тяг|станова[а-яё]*\s*тяг|тяги?\s*на\s*прям/,
	['upper legs', 'lower legs']
];

/** Rough RU/EN keyword → catalog body_part values. */
const PART_RULES: Array<[RegExp, string[]]> = [
	[/груд|chest|pec/, ['chest']],
	// «back» as word only (not feedback); «тяга» still maps pull/back days
	[/спин|\bbacks?\b|тяга|крыл/, ['back']],
	// «плеч» but not inside «предплечье»
	[/(?<!пред)плеч|shoulder|дельт/, ['shoulders']],
	[/трицеп|триц|triceps|tricep/, ['upper arms']],
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

/** Markers that negate the body part that follows them. */
const NEG_PREFIX =
	/без|исключ\w*|убра\w*|убер\w*|пропуст\w*|избега\w*|побере\w*|не\s*(?:надо|нужн|хочу|хотел|тренир|включа|трога|дела|став)|\bno\b|\bwithout\b|\bskip\b|\bavoid\b|\bexclude\b/g;

/** Pain / injury markers: only the nearest body part is excluded.
 *  NOTE: `\b` is ASCII-only in JS, so Cyrillic endings use a negative lookahead. */
const PAIN_MARKER =
	/травм\w*|бол(?:ит|ят|ел\w*|ь|езн\w*)(?![а-яё])|повреж\w*|воспал\w*|\bpain\b|\bhurt\b|\binjur\w*|\bsore\b/g;

function globalRe(re: RegExp): RegExp {
	return re.flags.includes('g') ? re : new RegExp(re.source, `${re.flags}g`);
}

type PartMatch = { part: string; start: number; end: number };

function partMatches(clause: string): PartMatch[] {
	const out: PartMatch[] = [];
	for (const [re, vals] of PART_RULES) {
		for (const m of clause.matchAll(globalRe(re))) {
			if (m.index == null) continue;
			for (const part of vals) {
				out.push({ part, start: m.index, end: m.index + m[0].length });
			}
		}
	}
	return out;
}

/** Split on sentence punctuation and contrast conjunctions, not on enumeration. */
function briefClauses(brief: string): string[] {
	return brief
		.toLowerCase()
		.split(/[.,;!?\n]+|\s+(?:но|а)\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * Body parts the brief asks to skip: "болят плечи", "без плеч", "no shoulders".
 * Pain markers exclude only the nearest part so "болят плечи, хочу ноги" keeps legs.
 */
export function exclusionsFromBrief(brief: string): string[] {
	const excluded: string[] = [];
	for (const clause of briefClauses(brief)) {
		const parts = partMatches(clause);
		if (!parts.length) continue;

		for (const m of clause.matchAll(NEG_PREFIX)) {
			if (m.index == null) continue;
			const spanEnd = m.index + m[0].length + 34;
			for (const p of parts) {
				if (p.start >= m.index && p.start <= spanEnd) excluded.push(p.part);
			}
		}

		for (const m of clause.matchAll(PAIN_MARKER)) {
			if (m.index == null) continue;
			const center = m.index + m[0].length / 2;
			let nearest: PartMatch | null = null;
			let nearestDist = Infinity;
			for (const p of parts) {
				const dist = Math.abs(p.start + (p.end - p.start) / 2 - center);
				if (dist < nearestDist) {
					nearestDist = dist;
					nearest = p;
				}
			}
			if (nearest && nearestDist <= 30) excluded.push(nearest.part);
		}
	}
	return [...new Set(excluded)];
}

/** Parts to build the plan for: mentioned zones minus explicit exclusions. */
export function effectivePartsFromBrief(brief: string): string[] {
	const { parts } = hintsFromBrief(brief);
	const exclude = exclusionsFromBrief(brief);
	return parts.filter((part) => !exclude.includes(part));
}

/** Rough RU/EN keyword → catalog fields for prompt slimdown. */
export function hintsFromBrief(brief: string): BodyHint {
	const t = brief.toLowerCase();
	const parts: string[] = [];
	const equipment: string[] = [];

	if (HINGE_PART_RULE[0].test(t)) parts.push(...HINGE_PART_RULE[1]);

	for (const [re, vals] of PART_RULES) {
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

/** Fine-grained muscle targets (catalog `target`) from brief slang. */
export function targetsFromBrief(brief: string): string[] {
	const t = brief.toLowerCase();
	const targets: string[] = [];
	if (/трицеп|триц|triceps|tricep/.test(t)) targets.push('triceps');
	if (/бицеп|biceps|бицух|банк[аиу]/.test(t)) targets.push('biceps');
	if (/дельт|боков(ая|ые)|средн(яя|ие)\s*дельт|lateral/.test(t)) targets.push('delts');
	if (/квадр|quad/.test(t)) targets.push('quads');
	if (/ягод|glute|булк|галифе/.test(t)) targets.push('glutes');
	if (/икр|\bcalf\b|\bcalves\b/.test(t)) targets.push('calves');
	if (/пресс|абдом|abs?\b|core/.test(t)) targets.push('abs');
	return [...new Set(targets)];
}

/**
 * Target plan size from duration words in brief.
 * ~45 мин → 6, ~60 мин / «час» → 7, 75+ → 8; otherwise leave to caller default.
 */
export function desiredExerciseCountFromBrief(brief: string, fallback = 5): number {
	const t = brief.toLowerCase();
	/* Decimal hours first («0.5 часа») so integer capture does not eat «5» from «0.5». */
	const decimalHour = /(\d+[.,]\d+)\s*(?:час|часа|часов|h\b|hour|hours)/.exec(t);
	const hourish = /(\d+)\s*(?:час|часа|часов|h\b|hour|hours)/.exec(t);
	const minish = /(\d+)\s*(?:мин|минуты|минут|min|mins|minutes)/.exec(t);
	let minutes = 0;
	if (decimalHour) {
		minutes = Number(decimalHour[1]!.replace(',', '.')) * 60;
	} else if (hourish) {
		minutes = Number(hourish[1]) * 60;
	} else if (minish) {
		minutes = Number(minish[1]);
	} else if (/(?:^|[\s,])час(?:$|[\s,.!?]|$)/.test(t) || /\bhour\b/.test(t)) {
		minutes = 60;
	}
	if (!Number.isFinite(minutes) || minutes <= 0) return fallback;
	if (minutes >= 75) return 8;
	if (minutes >= 55) return 7;
	if (minutes >= 40) return 6;
	return fallback;
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
	indexAll: ExerciseIndexItem[],
	brief: string
): ExerciseIndexItem[] {
	if (!indexAll.length) return [];

	const { parts: hintedParts, equipment } = hintsFromBrief(brief);
	const exclude = exclusionsFromBrief(brief);
	const parts = hintedParts.filter((part) => !exclude.includes(part));
	// Never offer an excluded body part to the model.
	const index = exclude.length
		? indexAll.filter((ex) => !exclude.includes(ex.body_part))
		: indexAll;
	if (!index.length) return [];

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
