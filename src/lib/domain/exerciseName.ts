import type { AppLocale } from '$lib/i18n/locale';
import type { ExerciseIndexItem } from './types';
import ruOverrides from '$lib/data/exerciseNamesRuOverrides.json' with { type: 'json' };

const RU_OVERRIDES = ruOverrides as Record<string, string>;

/**
 * English tokens that distinguish near-duplicate catalog rows.
 * Applied when the RU title dropped them (e.g. three "Присед в машине Смита").
 */
const TECHNIQUE_MARKERS: Array<{ test: RegExp; ru: string }> = [
	{ test: /\bsumo\b/i, ru: 'сумо' },
	{ test: /\bfull squat\b/i, ru: 'полный' },
	{ test: /\bwith straps\b/i, ru: 'с лямками' },
	{ test: /\bpalms[- ]down\b/i, ru: 'ладони вниз' },
	{ test: /\bpalms[- ]up\b/i, ru: 'ладони вверх' },
	{ test: /\btuck\b/i, ru: 'подтягивание колен' },
	{ test: /\(female\)/i, ru: 'жен. техника' },
	{ test: /\bfront lever reps\b/i, ru: 'динамический' },
	{ test: /\bclean and jerk\b/i, ru: 'взятие и толчок' },
	{ test: /\bpush stretch\b/i, ru: 'с отталкиванием' },
	{ test: /\bstiff leg\b/i, ru: 'чуть согнутые ноги' },
	{ test: /\bstraight leg\b/i, ru: 'прямые ноги' },
	{ test: /\bbiceps?\s+curl\b/i, ru: 'на бицепс' },
	{ test: /\bv\.\s*2\b/i, ru: 'другой ракурс' }
];

/**
 * Catalog `name_ru` is partly machine-translated (mixed EN/RU, awkward order).
 * Prefer curated overrides, then displayable `name_ru`, else English title.
 * Near-duplicate rows keep a technique qualifier from the English source name.
 */
export function exerciseName(
	item: Pick<ExerciseIndexItem, 'id' | 'name' | 'name_ru'> | Pick<ExerciseIndexItem, 'name' | 'name_ru'>,
	locale: AppLocale = 'ru'
): string {
	const english = titleCaseExerciseName(item.name);
	if (locale !== 'ru') return english;

	const id = 'id' in item ? item.id : undefined;
	if (id) {
		const override = RU_OVERRIDES[id];
		if (override) return polishRuDisplayName(override, item.name);
	}

	const ru = item.name_ru?.trim();
	if (ru && isDisplayableRuName(ru)) return polishRuDisplayName(ru, item.name);

	return english;
}

export function exerciseEnglishName(item: Pick<ExerciseIndexItem, 'name'>): string {
	return titleCaseExerciseName(item.name);
}

export function exerciseNameSortLocale(locale: AppLocale): string {
	return locale === 'ru' ? 'ru' : 'en';
}

/** Reject mixed EN/RU and leftover tokens like `pov`. */
const MIXED_EN_BLOCKLIST =
	/\b(tap|flip|towel|motion|slingers|rollerout|bottoms|cocoons|judo|russian|bicycle|windmill|oblique|negative|pelvic|landmine|planche|otis|slam|crab|lean)\b/i;

export function isDisplayableRuName(ru: string): boolean {
	const value = ru.trim();
	if (!value) return false;
	if (!/[а-яё]/i.test(value)) return false;
	if (/[A-Za-z]{4,}/.test(value)) return false;
	if (/[а-яё]/i.test(value) && MIXED_EN_BLOCKLIST.test(value)) return false;
	if (/\bpov\b/i.test(value)) return false;
	return true;
}

/** Machine glosses left masc. adjectives on fem. «тяга» / neut. «сгибание». */
const AGREEMENT_PAIRS: Array<[string, string]> = [
	['боковой тяга', 'боковая тяга'],
	['верхний тяга', 'верхняя тяга'],
	['нижний тяга', 'нижняя тяга'],
	['задний тяга', 'задняя тяга'],
	['передний тяга', 'передняя тяга'],
	['узкий тяга', 'узкая тяга'],
	['широкий тяга', 'широкая тяга'],
	['высокий тяга', 'высокая тяга'],
	['низкий тяга', 'низкая тяга'],
	['поочерёдный тяга', 'поочерёдная тяга'],
	['односторонний тяга', 'односторонняя тяга'],
	['ротационный тяга', 'ротационная тяга'],
	['кубинское жим', 'кубинский жим'],
	['молотковый сгибание', 'молотковое сгибание'],
	['наклонный сгибание', 'наклонное сгибание'],
	['обратный сгибание', 'обратное сгибание'],
	['поочерёдный сгибание', 'поочерёдное сгибание'],
	['внутренний сгибание', 'внутреннее сгибание'],
	['высокий сгибание', 'высокое сгибание'],
	['широкий сгибание', 'широкое сгибание'],
	['нижний сгибание', 'нижнее сгибание'],
	['молотковый разгибание', 'молотковое разгибание'],
	['наклонный разгибание', 'наклонное разгибание'],
	['боковой разгибание', 'боковое разгибание'],
	['поочерёдный разгибание', 'поочерёдное разгибание'],
	['обратный разведение', 'обратное разведение'],
	['наклонный разведение', 'наклонное разведение'],
	['задний разведение', 'заднее разведение'],
	['низкий разведение', 'нижнее разведение'],
	['обратный скручивание', 'обратное скручивание'],
	['боковой скручивание', 'боковое скручивание'],
	['с канатом рукоятью', 'с канатной рукоятью'],
	['осла подъём на носки', 'подъём на носки «ослик»']
];

function replacePhrasePreserveCap(hay: string, from: string, to: string): string {
	const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
	return hay.replace(re, (matched) => {
		const lead = matched[0];
		if (lead && lead !== lead.toLowerCase()) {
			return to.charAt(0).toUpperCase() + to.slice(1);
		}
		return to;
	});
}

function polishRuDisplayName(ruName: string, englishRaw: string): string {
	let normalized = ruName
		.replace(/\s*\(вариант 2\)/gi, ' (другой ракурс)')
		.replace(/\bвариант 2\b/gi, '(другой ракурс)')
		.replace(/вверх лицом собака/gi, 'Собака мордой вверх')
		.replace(/вниз лицом собака/gi, 'Собака мордой вниз')
		.replace(/силовой планка/gi, 'планка на прямых руках')
		.replace(/передний планка/gi, 'планка')
		.replace(/обратный планка/gi, 'обратная планка')
		.replace(/сидя широкий под углом поза/gi, 'поза широкого угла сидя');
	for (const [from, to] of AGREEMENT_PAIRS) {
		normalized = replacePhrasePreserveCap(normalized, from, to);
	}
	normalized = normalized.replace(/\s{2,}/g, ' ').trim();
	if (normalized) {
		normalized = normalized[0]!.toUpperCase() + normalized.slice(1);
	}
	const qualified = withTechniqueQualifier(normalized, englishRaw);
	return qualified.replace(/(?:\s*\(другой ракурс\))+/gi, ' (другой ракурс)');
}

function withTechniqueQualifier(ruName: string, englishRaw: string): string {
	const ruNorm = ruName.toLowerCase();
	const extras: string[] = [];
	for (const marker of TECHNIQUE_MARKERS) {
		if (!marker.test.test(englishRaw)) continue;
		if (ruNorm.includes(marker.ru.toLowerCase())) continue;
		extras.push(marker.ru);
	}
	if (extras.length === 0) return ruName;
	return `${ruName} (${extras.join(', ')})`;
}

function titleCaseExerciseName(raw: string): string {
	return raw
		.trim()
		.split(/\s+/)
		.map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
		.join(' ');
}
