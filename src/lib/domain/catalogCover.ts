import type { ExerciseIndexItem } from './types';

/** Prefer iconic, muscle-readable Gym Visual plates; avoid stretches/cardio jumps. */
const TARGET_COVER_WEIGHTS: Partial<Record<string, [RegExp, number][]>> = {
	lats: [
		[/pull-up|подтяги|chin-up/i, 16],
		[/lat pulldown|тяга верхнего блок/i, 12],
		[/barbell row|тяга штанги|pendlay|гребл/i, 10]
	],
	pectorals: [
		[/bench press|жим лёжа|жим на/i, 15],
		[/fly|развод|pec deck/i, 12],
		[/push-up|отжим/i, 8]
	],
	delts: [
		[/overhead press|жим над голов|shoulder press|армейск/i, 15],
		[/lateral raise|махи|front raise|подъём впер/i, 12]
	],
	biceps: [
		[/^barbell curl\b|сгибание на бицепс со штангой$/i, 15],
		[/curl|сгиб/i, 10]
	],
	triceps: [
		[/разгибание на трицепс на блоке|triceps pushdown|pushdown/i, 16],
		[/skull|француз|extension|разгиб/i, 12],
		[/close.?grip|узким хватом жим/i, 10]
	],
	abs: [
		[/скручивание на пол|floor crunch|скручивания на пол/i, 14],
		[/crunch|скруч/i, 12],
		[/plank|планк/i, 10]
	],
	forearms: [
		[/barbell wrist curl|сгибание запястий со штанг/i, 16],
		[/wrist curl|сгибание запяст/i, 12]
	],
	'cardiovascular system': [
		[/run \(equipment\)|бег \(тренаж/i, 16],
		[/treadmill|дорож/i, 14],
		[/run|бег/i, 12],
		[/cycle|велос|bike|эллипс/i, 10],
		[/jump rope|скакал/i, 8]
	],
	traps: [[/shrug|шраг/i, 15]],
	'upper back': [
		[/bent over row|тяга штанги в наклоне/i, 16],
		[/pendlay|barbell row|тяга штанги|гребл/i, 14],
		[/face pull|тяга.*лиц/i, 12]
	],
	spine: [
		[/hyperextension|гиперэкстенз/i, 15],
		[/deadlift|станов/i, 12]
	],
	'serratus anterior': [
		[/scapula push|scapula отжим/i, 14],
		[/push-up|отжим|serratus/i, 12]
	],
	'levator scapulae': [[/neck|ше/i, 8]],
	quads: [
		[/leg extension|разгибание ног/i, 15],
		[/leg press|жим ног/i, 12],
		[/squat|присед|lunge|выпад|split/i, 10]
	],
	hamstrings: [
		[/leg curl|сгибание ног(?!.*обрат)/i, 15],
		[/deadlift|румын|rdl|тяга на прямых/i, 12],
		[/good morning|наклон/i, 8]
	],
	glutes: [
		[/hip thrust|ягодичн.*мост|glute bridge/i, 17],
		[/мост|bridge/i, 10],
		[/bulgarian|болгар|выпад|lunge/i, 10],
		[/squat|присед/i, 8]
	],
	calves: [
		[/standing calf|подъём на носки(?!.*сидя)/i, 16],
		[/calf raise|подъём на носк|икронож|calves/i, 12],
		[/jump rope|скакал/i, 5]
	],
	abductors: [[/abduct|абдукт|outer thigh|внешн/i, 15]],
	adductors: [[/adduct|аддукт|inner thigh|внутренн/i, 15]]
};

const COVER_AVOID = /jump|прыж|stretch|растяж|balance board|reach|burpee|берп/i;

/** Variant / band plates read poorly on small category cards. */
const COVER_VARIANT =
	/alternate|поочер|reverse|обратн|parallel|параллель|one arm|одной рук|узк|narrow|wide|широк|variant|вариант|band|резин|support|поддерж|towel|полотен|колен|kneeling|behind|за спин|за голов|из-за голов|blaster|drag|assist|лучник|3\/4|вниз головой|incline|наклон|decline|prone|живот|seated calf|сидя подъём на носк/i;

/** «Все упражнения» card — zone-level iconic lift per hub slug. */
const ZONE_COVER_WEIGHTS: Partial<Record<string, [RegExp, number][]>> = {
	back: [
		[/lat pulldown|тяга верхнего блок/i, 16],
		[/pull-up|подтяги|chin-up/i, 13],
		[/barbell row|тяга штанги|pendlay|гребл/i, 12],
		[/верхн.*тяга.*блок|upper row/i, 10]
	],
	/** Prefer standing fly/crossover so «Все» ≠ pectorals bench silhouette. */
	chest: [
		[/fly|развод|pec deck|crossover|кроссовер/i, 16],
		[/push-up|отжим/i, 12],
		[/bench press|жим.*скам|жим лёжа|жим на/i, 8]
	],
	shoulders: [
		[/barbell seated overhead press|жим над головой сидя со штанг/i, 16],
		[/dumbbell lateral raise|разведение гантелей в стороны/i, 15],
		[/lateral raise|махи в сторон|разведение.*сторон/i, 13],
		[/overhead press|жим над голов|shoulder press|армейск/i, 9]
	],
	waist: [
		[/скручивание на пол|floor crunch|скручивания на пол/i, 14],
		[/front plank|планка(?!.*скруч|.*боков)/i, 12],
		[/plank|планк/i, 10],
		[/cable.*crunch|скручивание на блок/i, 9],
		[/crunch|скруч|sit-up/i, 7]
	],
	'upper arms': [
		[/^barbell curl\b|сгибание на бицепс со штангой$/i, 16],
		[/skull crusher|французский жим|lying triceps extension/i, 15],
		[/triceps pushdown|разгибание на трицепс на блок|cable pushdown/i, 12],
		[/curl|сгиб/i, 10],
		[/triceps|разгиб/i, 8]
	],
	'lower arms': [[/barbell wrist curl|сгибание запястий со штанг/i, 14], [/wrist curl|сгибание запяст/i, 10]],
	cardio: [
		[/^run$|^бег$/i, 16],
		[/run|бег/i, 14],
		[/cycle|велос|bike|эллипс/i, 12],
		[/jump rope|скакал/i, 8]
	],
	neck: [[/neck|ше/i, 8]],
	legs: [
		[/full squat|присед со штанг/i, 18],
		[/squat|присед/i, 14],
		[/leg press|жим ног/i, 10],
		[/leg extension|разгибание ног/i, 8]
	],
	'upper legs': [
		[/full squat|присед со штанг/i, 18],
		[/squat|присед/i, 14],
		[/leg press|жим ног/i, 10],
		[/leg extension|разгибание ног/i, 8]
	],
	'lower legs': [[/standing calf|подъём на носки(?!.*сидя)|calf raise|икронож/i, 14]]
};

/** Dataset has only stretch plates for neck — pick the cleaner side stretch. */
const TARGET_COVER_OVERRIDES: Partial<Record<string, string>> = {
	'levator scapulae': '1403',
	/** Classic hanging pull-up reads clearer than cable pulldown on small cards. */
	lats: '0652',
	/** Standing calf silhouette reads better than seated. */
	calves: '1373',
	/** Classic palms-up wrist curl (not behind-the-back). */
	forearms: '0126',
	/** Bent-over row is the clearest upper-back plate. */
	'upper back': '0027'
};

const ZONE_COVER_OVERRIDES: Partial<Record<string, string>> = {
	/** Standing cable fly — distinct from flat-bench pectorals plate. */
	chest: '0227',
	/** Barbell squat — iconic legs, distinct from machine isolation cards. */
	legs: '0043',
	/** Outdoor run — distinct from treadmill cardio target plate. */
	cardio: '0685',
	neck: '1403'
};

function exerciseLabel(ex: ExerciseIndexItem): string {
	return `${ex.name} ${ex.name_ru ?? ''}`.toLowerCase();
}

function coverScore(ex: ExerciseIndexItem, target?: string): number {
	let score = 0;
	const label = exerciseLabel(ex);
	if (target) {
		for (const [pattern, weight] of TARGET_COVER_WEIGHTS[target] ?? []) {
			if (pattern.test(label)) score = Math.max(score, weight);
		}
	}
	if (COVER_AVOID.test(label)) score -= 20;
	if (COVER_VARIANT.test(label)) score -= 6;
	if (target === 'triceps' && /наклон|incline/i.test(label)) score -= 8;
	if (target === 'triceps' && /канат|rope/i.test(label)) score -= 4;
	if (target === 'serratus anterior' && /наклон|incline/i.test(label)) score -= 6;
	if (target && ex.target === ex.muscle_group) score += 1;
	return score;
}

function zoneCoverScore(ex: ExerciseIndexItem, zone: string): number {
	let score = 0;
	const label = exerciseLabel(ex);
	for (const [pattern, weight] of ZONE_COVER_WEIGHTS[zone] ?? []) {
		if (pattern.test(label)) score = Math.max(score, weight);
	}
	if (COVER_AVOID.test(label)) score -= 20;
	if (COVER_VARIANT.test(label)) score -= 6;
	return score;
}

function pickByOverride(
	list: ExerciseIndexItem[],
	overrideId: string | undefined
): ExerciseIndexItem | undefined {
	if (!overrideId) return undefined;
	return list.find((ex) => ex.id === overrideId);
}

/** Hub / «Все упражнения» card art for a catalog zone. */
export function pickZoneCoverImage(
	list: ExerciseIndexItem[],
	zone: string,
	avoidImages: ReadonlySet<string> = new Set()
): string {
	if (!list.length) return '';

	const override = pickByOverride(list, ZONE_COVER_OVERRIDES[zone]);
	if (override?.image && !avoidImages.has(override.image)) return override.image;

	const ranked = [...list].sort((a, b) => {
		const diff = zoneCoverScore(b, zone) - zoneCoverScore(a, zone);
		return diff !== 0 ? diff : a.id.localeCompare(b.id);
	});

	const preferred = ranked.find((ex) => ex.image && !avoidImages.has(ex.image));
	return preferred?.image ?? ranked[0]?.image ?? '';
}

/** Target/category card art: scored pick; zone fallback skips weak plates. */
export function pickCatalogCoverImage(list: ExerciseIndexItem[], target?: string): string {
	if (!list.length) return '';
	if (!target) return pickZoneCoverImage(list, '');

	const override = pickByOverride(list, TARGET_COVER_OVERRIDES[target]);
	if (override?.image) return override.image;

	const ranked = [...list].sort((a, b) => {
		const diff = coverScore(b, target) - coverScore(a, target);
		return diff !== 0 ? diff : a.id.localeCompare(b.id);
	});

	return ranked[0]?.image ?? '';
}

export function runCatalogCoverSelfCheck(): void {
	const quads: ExerciseIndexItem[] = [
		{
			id: '1472',
			name: 'forward jump',
			name_ru: 'Вперёд прыжок',
			body_part: 'upper legs',
			equipment: 'body weight',
			target: 'quads',
			muscle_group: 'quads',
			secondary_muscles: [],
			globalPopularity: 25,
			image: 'images/1472-uZKq7lo.jpg'
		},
		{
			id: '0585',
			name: 'lever leg extension',
			name_ru: 'Разгибание ног в тренажёре',
			body_part: 'upper legs',
			equipment: 'lever',
			target: 'quads',
			muscle_group: 'quads',
			secondary_muscles: [],
			globalPopularity: 25,
			image: 'images/0585-my33uHU.jpg'
		}
	];

	const pick = pickCatalogCoverImage(quads, 'quads');
	if (!pick.includes('0585')) {
		throw new Error('quads cover should prefer leg extension over jump');
	}

	const back: ExerciseIndexItem[] = [
		{
			id: '0007',
			name: 'alternate lateral pulldown',
			name_ru: 'Поочерёдная тяга верхнего блока',
			body_part: 'back',
			equipment: 'cable',
			target: 'lats',
			muscle_group: 'lats',
			secondary_muscles: [],
			globalPopularity: 25,
			image: 'images/0007-4IKbhHV.jpg'
		},
		{
			id: '2330',
			name: 'cable lat pulldown full range of motion',
			name_ru: 'Тяга верхнего блока',
			body_part: 'back',
			equipment: 'cable',
			target: 'lats',
			muscle_group: 'lats',
			secondary_muscles: [],
			globalPopularity: 25,
			image: 'images/2330-LEprlgG.jpg'
		}
	];

	const backPick = pickZoneCoverImage(back, 'back');
	if (!backPick.includes('2330')) {
		throw new Error('back zone cover should prefer standard lat pulldown over alternate');
	}

	const latsPick = pickCatalogCoverImage(back, 'lats');
	if (!latsPick.includes('2330')) {
		throw new Error('lats cover should prefer standard lat pulldown when pull-up is absent');
	}

	const latsWithPullUp: ExerciseIndexItem[] = [
		...back,
		{
			id: '0652',
			name: 'pull-up',
			name_ru: 'Подтягивания',
			body_part: 'back',
			equipment: 'body weight',
			target: 'lats',
			muscle_group: 'lats',
			secondary_muscles: [],
			globalPopularity: 90,
			image: 'images/0652-x.jpg'
		}
	];
	if (!pickCatalogCoverImage(latsWithPullUp, 'lats').includes('0652')) {
		throw new Error('lats cover should prefer classic pull-up when present');
	}

	const legsZone: ExerciseIndexItem[] = [
		{
			id: '0585',
			name: 'lever leg extension',
			name_ru: 'Разгибание ног в тренажёре',
			body_part: 'upper legs',
			equipment: 'lever',
			target: 'quads',
			muscle_group: 'quads',
			secondary_muscles: [],
			globalPopularity: 25,
			image: 'images/0585-x.jpg'
		},
		{
			id: '0043',
			name: 'barbell full squat',
			name_ru: 'Присед со штангой',
			body_part: 'upper legs',
			equipment: 'barbell',
			target: 'glutes',
			muscle_group: 'quadriceps',
			secondary_muscles: [],
			globalPopularity: 99,
			image: 'images/0043-x.jpg'
		}
	];
	if (!pickZoneCoverImage(legsZone, 'legs', new Set(['images/0585-x.jpg'])).includes('0043')) {
		throw new Error('legs zone cover should prefer squat over leg extension');
	}

	const calves: ExerciseIndexItem[] = [
		{
			id: '0088',
			name: 'barbell seated calf raise',
			name_ru: 'Сидя подъём на носки со штангой',
			body_part: 'lower legs',
			equipment: 'barbell',
			target: 'calves',
			muscle_group: 'calves',
			secondary_muscles: [],
			globalPopularity: 25,
			image: 'images/0088-x.jpg'
		},
		{
			id: '1373',
			name: 'bodyweight standing calf raise',
			name_ru: 'Подъём на носки',
			body_part: 'lower legs',
			equipment: 'body weight',
			target: 'calves',
			muscle_group: 'calves',
			secondary_muscles: [],
			globalPopularity: 25,
			image: 'images/1373-x.jpg'
		}
	];
	if (!pickCatalogCoverImage(calves, 'calves').includes('1373')) {
		throw new Error('calves cover should prefer standing raise');
	}

	const chest: ExerciseIndexItem[] = [
		{
			id: '0009',
			name: 'assisted chest dip (kneeling)',
			name_ru: 'Отжимания на брусьях с поддержкой (на коленях)',
			body_part: 'chest',
			equipment: 'leverage machine',
			target: 'pectorals',
			muscle_group: 'triceps',
			secondary_muscles: [],
			globalPopularity: 25,
			image: 'images/0009-x.jpg'
		},
		{
			id: '0025',
			name: 'barbell bench press',
			name_ru: 'Жим лёжа со штангой',
			body_part: 'chest',
			equipment: 'barbell',
			target: 'pectorals',
			muscle_group: 'triceps',
			secondary_muscles: [],
			globalPopularity: 25,
			image: 'images/0025-y.jpg'
		},
		{
			id: '0227',
			name: 'cable standing fly',
			name_ru: 'Стоя разведение на блоке',
			body_part: 'chest',
			equipment: 'cable',
			target: 'pectorals',
			muscle_group: 'deltoids',
			secondary_muscles: [],
			globalPopularity: 25,
			image: 'images/0227-Pr9Rhf4.jpg'
		}
	];

	if (!pickCatalogCoverImage(chest, 'pectorals').includes('0025')) {
		throw new Error('pectorals cover should prefer bench press over assisted dip');
	}

	const chestZone = pickZoneCoverImage(chest, 'chest', new Set(['images/0025-y.jpg']));
	if (chestZone.includes('0025')) {
		throw new Error('chest zone cover should avoid the top target (pectorals) plate');
	}
	if (!chestZone.includes('0227')) {
		throw new Error('chest zone cover should use standing fly, not another bench');
	}

	const arms: ExerciseIndexItem[] = [
		{
			id: '0023',
			name: 'barbell alternate biceps curl',
			name_ru: 'Поочерёдный сгибание на бицепс со штангой',
			body_part: 'upper arms',
			equipment: 'barbell',
			target: 'biceps',
			muscle_group: 'forearms',
			secondary_muscles: [],
			globalPopularity: 25,
			image: 'images/0023-x.jpg'
		},
		{
			id: '0031',
			name: 'barbell curl',
			name_ru: 'Сгибание на бицепс со штангой',
			body_part: 'upper arms',
			equipment: 'barbell',
			target: 'biceps',
			muscle_group: 'forearms',
			secondary_muscles: [],
			globalPopularity: 25,
			image: 'images/0031-y.jpg'
		}
	];

	if (!pickCatalogCoverImage(arms, 'biceps').includes('0031')) {
		throw new Error('biceps cover should prefer barbell curl over alternate');
	}
}
