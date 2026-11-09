/**
 * Home equipment kit: virtual catalog filter `home` over selected gear groups.
 * Bodyweight is always included. Optional groups live in local prefs (not synced).
 */

/** LocalStorage / AsyncStorage key (same on web + RN). */
export const HOME_KIT_STORAGE_KEY = 'repdraft:home-kit';

export const HOME_EQUIPMENT_FILTER = 'home';

export type HomeKitGroupId =
	| 'bodyweight'
	| 'band'
	| 'dumbbell'
	| 'kettlebell'
	| 'jumpRope'
	| 'roller'
	| 'weighted'
	| 'stabilityBall'
	| 'medicineBall'
	| 'wheelRoller';

/** Always matched when filtering by home. Not stored in prefs. */
export const HOME_KIT_ALWAYS_ON: HomeKitGroupId = 'bodyweight';

/** Toggleable groups shown in the kit sheet (default off). */
export const HOME_KIT_OPTIONAL_GROUPS = [
	'band',
	'dumbbell',
	'kettlebell',
	'jumpRope',
	'roller',
	'weighted',
	'stabilityBall',
	'medicineBall',
	'wheelRoller'
] as const satisfies readonly HomeKitGroupId[];

export type HomeKitOptionalId = (typeof HOME_KIT_OPTIONAL_GROUPS)[number];

const OPTIONAL_SET = new Set<string>(HOME_KIT_OPTIONAL_GROUPS);

const JUMP_ROPE_NAME = /jump\s*rope|скакал/i;

/**
 * Extra gear the home kit does not cover: gym benches, bars, machines, boxes…
 * Applied to every kit match (not only bodyweight): dumbbell + incline bench stays gym.
 * Chair / floor dips are allowlisted separately.
 */
const HOME_KIT_GYM_EXTRA =
	/incline|decline|preacher|peacher|scott|скотт|\bsmith\b|cable|\bmachine\b|тренаж|leverage|\blever\b|assisted|pull[\s-]?ups?|chin[\s-]?ups?|\bchin\b|hanging|в висе|брусь|parallel\s*bars?|dip[\s-]*pull|chest\s+dip|triceps\s+dips?|elbow\s+dips?|impossible\s+dips?|korean\s+dips?|one\s+arm\s+dip|reverse\s+dip|ring\s+dips?|scapula\s+dips?|wide[\s-]*grip\s+chest\s+dip|\brings\b|кольц(?:ах|а|о)|hyperextension|гиперэкстенз|45\s*[°º]?\s*side\s*bend|side\s*bend\s*(?:at\s*)?45|под\s*45\s*[°º]?|balance\s*board|wobble\s*board|балансировк\w*\s+на\s+доск|на\s+доске|glute[\s-]?ham|muscle[\s-]?ups?|выход силой|inverted\s+row|подтягиван(?!ие колен)|back\s+lever|front\s+lever|(?:human\s+)?\bflag\b|suspension|suspended|в подвеске|\btrx\b|australian\s+pull|toes?\s*to\s*bar|side\s+hip\s*\(on\s+parallel|vertical\s+leg\s+raise\s*\(on\s+parallel|captain'?s?\s*chair|капитанск|roman\s+chair|римск\w*\s+стул|турник|перекладин|cage|bosu|босу|sled|hack\s+squat|leg\s+press|landmine|arm\s+blaster|ez\s+bar|olympic|trap\s+bar|\bbarbell\b|штан|box\s+jump|тумб|step[\s-]?up|stepbox|step\s*box|flat\s+bench|наклонной скамь|горизонтальн\w*\s+скамь|вниз головой|bench\s+press|\bon\s+bench\b|\bbenches?\b(?!\s+dip)|на скамь|скамь|platform|платформ|wheel\s*run|бег с колес|wrist\s*roll|ролик для запяст|treadmill|беговой дорожк|run\s*\(\s*equipment\s*\)|возвышен|drop\s+(?:push|jump)|drop\s+jump/i;

/** Chair / bench / floor dips are fine at home even if the EN name says "dip". */
const HOME_FRIENDLY_DIP =
	/bench\s+dip|dip\s+on\s+floor|dips?\s+floor|triceps\s+dip\s*\([^)]*bench|triceps\s+dips?\s+floor|отжимания от скамьи|отжимания на трицепс от (скамьи|пола)/i;

/** Floor-only assisted variants that would otherwise hit `assisted`. */
const HOME_FRIENDLY_ASSISTED_FLOOR =
	/self\s+assisted\s+inverse\s+leg\s+curl\s*\(on\s+floor\)|с поддержкой обратное сгибание ног\s*\(на полу\)/i;

const HOME_FRIENDLY_DIP_GI = new RegExp(HOME_FRIENDLY_DIP.source, 'gi');
const HOME_FRIENDLY_ASSISTED_FLOOR_GI = new RegExp(HOME_FRIENDLY_ASSISTED_FLOOR.source, 'gi');

/** ponytail: name-blob → gym-extra; catalog is static, kit toggles re-scan often. */
const gymExtraBlockedCache = new Map<string, boolean>();

const NEEDS_STABILITY_BALL = /exercise\s+ball|stability\s+ball|фитбол/i;

export type HomeKitExerciseHint = {
	equipment?: string | null;
	name?: string | null;
	name_ru?: string | null;
};

export function isHomeEquipmentFilter(value: string | null | undefined): boolean {
	return (value ?? '').trim().toLowerCase() === HOME_EQUIPMENT_FILTER;
}

export function isHomeKitOptionalId(value: string): value is HomeKitOptionalId {
	return OPTIONAL_SET.has(value);
}

/** Drop unknown ids; bodyweight is never stored. */
export function normalizeHomeKitSelection(raw: readonly string[]): HomeKitOptionalId[] {
	const out: HomeKitOptionalId[] = [];
	const seen = new Set<string>();
	for (const id of raw) {
		if (!isHomeKitOptionalId(id) || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out;
}

/** Bodyweight + optional selection for matching. */
export function resolveHomeKitGroups(
	selected: readonly string[] | null | undefined
): HomeKitGroupId[] {
	return [HOME_KIT_ALWAYS_ON, ...normalizeHomeKitSelection(selected ?? [])];
}

export function isJumpRopeExercise(hint: HomeKitExerciseHint): boolean {
	const eq = (hint.equipment ?? '').trim().toLowerCase();
	if (eq !== 'rope') return false;
	const blob = `${hint.name ?? ''} ${hint.name_ru ?? ''}`;
	return JUMP_ROPE_NAME.test(blob);
}

function homeKitNameBlob(hint: HomeKitExerciseHint): string {
	return `${hint.name ?? ''} ${hint.name_ru ?? ''}`;
}

/**
 * True when the move needs gear outside the resolved home kit
 * (gym bench, pull-up bar, machine, or a ball that is not selected).
 */
function isHomeKitGymExtraBlocked(hint: HomeKitExerciseHint): boolean {
	const blob = homeKitNameBlob(hint);
	const cached = gymExtraBlockedCache.get(blob);
	if (cached !== undefined) return cached;
	/* Strip chair/floor dips first so `скамья` in their RU names does not trip the gym list. */
	HOME_FRIENDLY_DIP_GI.lastIndex = 0;
	HOME_FRIENDLY_ASSISTED_FLOOR_GI.lastIndex = 0;
	const stripped = blob
		.replace(HOME_FRIENDLY_DIP_GI, ' ')
		.replace(HOME_FRIENDLY_ASSISTED_FLOOR_GI, ' ');
	const blocked = HOME_KIT_GYM_EXTRA.test(stripped);
	gymExtraBlockedCache.set(blob, blocked);
	return blocked;
}

export function homeKitBlockedByUnavailableGear(
	hint: HomeKitExerciseHint,
	groups: readonly HomeKitGroupId[]
): boolean {
	if (isHomeKitGymExtraBlocked(hint)) return true;

	const blob = homeKitNameBlob(hint);
	const resolved = groups.length > 0 ? groups : [HOME_KIT_ALWAYS_ON];
	if (NEEDS_STABILITY_BALL.test(blob) && !resolved.includes('stabilityBall')) {
		return true;
	}
	return false;
}

export function exerciseMatchesHomeKitGroup(
	hint: HomeKitExerciseHint,
	group: HomeKitGroupId
): boolean {
	const eq = (hint.equipment ?? '').trim().toLowerCase();
	switch (group) {
		case 'bodyweight':
			return eq === 'body weight';
		case 'band':
			return eq === 'band' || eq === 'resistance band';
		case 'dumbbell':
			return eq === 'dumbbell';
		case 'kettlebell':
			return eq === 'kettlebell';
		case 'jumpRope':
			return isJumpRopeExercise(hint);
		case 'roller':
			return eq === 'roller';
		case 'weighted':
			return eq === 'weighted';
		case 'stabilityBall':
			return eq === 'stability ball';
		case 'medicineBall':
			return eq === 'medicine ball';
		case 'wheelRoller':
			return eq === 'wheel roller';
		default: {
			const _exhaustive: never = group;
			return _exhaustive;
		}
	}
}

export function exerciseMatchesHomeKit(
	hint: HomeKitExerciseHint,
	groups: readonly HomeKitGroupId[]
): boolean {
	const resolved = groups.length > 0 ? groups : [HOME_KIT_ALWAYS_ON];
	if (!resolved.some((g) => exerciseMatchesHomeKitGroup(hint, g))) return false;
	return !homeKitBlockedByUnavailableGear(hint, resolved);
}

/**
 * Soft gear: log reps with empty kg or optional extra load (vest / cuffs).
 * Jump rope is name-scoped under `rope`.
 */
export function usesExtraKgField(hint: HomeKitExerciseHint): boolean {
	const eq = (hint.equipment ?? '').trim().toLowerCase();
	if (eq === 'body weight' || eq === 'band' || eq === 'resistance band') return true;
	if (eq === 'roller' || eq === 'stability ball') return true;
	if (isJumpRopeExercise(hint)) return true;
	return false;
}

/** Brief labels (AI / summary). Gym-plain, no long dashes. */
const BRIEF_LABEL_RU: Record<HomeKitGroupId, string> = {
	bodyweight: 'свой вес',
	band: 'резинка',
	dumbbell: 'гантели',
	kettlebell: 'гиря',
	jumpRope: 'скакалка',
	roller: 'роллер',
	weighted: 'утяжелитель',
	stabilityBall: 'фитбол',
	medicineBall: 'медбол',
	wheelRoller: 'гимнастическое колесо'
};

const BRIEF_LABEL_EN: Record<HomeKitGroupId, string> = {
	bodyweight: 'body weight',
	band: 'resistance band',
	dumbbell: 'dumbbells',
	kettlebell: 'kettlebell',
	jumpRope: 'jump rope',
	roller: 'foam roller',
	weighted: 'weighted vest',
	stabilityBall: 'stability ball',
	medicineBall: 'medicine ball',
	wheelRoller: 'ab wheel'
};

export function homeKitGroupBriefLabel(
	group: HomeKitGroupId,
	locale: 'ru' | 'en' = 'ru'
): string {
	return locale === 'en' ? BRIEF_LABEL_EN[group] : BRIEF_LABEL_RU[group];
}

/** Append kit gear to an AI brief. No-op when only bodyweight (empty optional kit). */
export function appendHomeKitToBrief(
	brief: string,
	selectedOptional: readonly string[],
	locale: 'ru' | 'en' = 'ru'
): string {
	const optional = normalizeHomeKitSelection(selectedOptional);
	if (optional.length === 0) return brief;
	const groups = resolveHomeKitGroups(optional);
	const labels = groups.map((g) => homeKitGroupBriefLabel(g, locale));
	const clause =
		locale === 'en'
			? `equipment only: ${labels.join(', ')}`
			: `только оборудование: ${labels.join(', ')}`;
	const trimmed = brief.trim();
	const lower = trimmed.toLowerCase();
	if (labels.some((l) => lower.includes(l.toLowerCase()))) {
		return trimmed;
	}
	if (!trimmed) return clause;
	return `${trimmed}, ${clause}`;
}

export function parseHomeKitStorage(raw: string | null | undefined): HomeKitOptionalId[] {
	if (raw == null || raw === '') return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return normalizeHomeKitSelection(parsed.map((v) => String(v)));
	} catch {
		return [];
	}
}

export function serializeHomeKitStorage(selected: readonly string[]): string {
	return JSON.stringify(normalizeHomeKitSelection(selected));
}

export function runHomeKitSelfCheck(): void {
	const bw = { equipment: 'body weight', name: 'push-up' };
	const band = { equipment: 'band', name: 'band pull' };
	const rb = { equipment: 'resistance band', name: 'face pull' };
	const ropeJump = { equipment: 'rope', name: 'jump rope', name_ru: 'Скакалка' };
	const battle = { equipment: 'rope', name: 'battling ropes' };
	const roller = { equipment: 'roller', name: 'foam roll' };

	const homeBw = resolveHomeKitGroups([]);
	const homeDb = resolveHomeKitGroups(['dumbbell']);
	if (!exerciseMatchesHomeKitGroup(bw, 'bodyweight')) throw new Error('bw group');
	if (!exerciseMatchesHomeKit(bw, homeBw)) throw new Error('bw home match');
	const chestDip = {
		equipment: 'body weight',
		name: 'chest dip',
		name_ru: 'Отжимания на брусьях на грудь'
	};
	const benchDip = {
		equipment: 'body weight',
		name: 'bench dip (knees bent)',
		name_ru: 'Отжимания от скамьи'
	};
	const pullUp = {
		equipment: 'body weight',
		name: 'pull-up',
		name_ru: 'Подтягивания на перекладине'
	};
	if (exerciseMatchesHomeKit(chestDip, homeBw)) {
		throw new Error('chest dip station must stay gym');
	}
	if (!exerciseMatchesHomeKit(benchDip, homeBw)) {
		throw new Error('bench dip is home-friendly');
	}
	const floorDip = {
		equipment: 'body weight',
		name: 'triceps dips floor',
		name_ru: 'Отжимания на трицепс от пола'
	};
	if (!exerciseMatchesHomeKit(floorDip, homeBw)) {
		throw new Error('floor triceps dip is home-friendly');
	}
	if (exerciseMatchesHomeKit(pullUp, homeBw)) {
		throw new Error('pull-up bar must stay gym');
	}
	const sideBend45 = {
		equipment: 'body weight',
		name: '45° side bend',
		name_ru: 'Наклон в сторону под 45°'
	};
	if (exerciseMatchesHomeKit(sideBend45, homeBw)) {
		throw new Error('45° hyperextension bench side bend must stay gym');
	}
	const balanceBoard = {
		equipment: 'body weight',
		name: 'balance board',
		name_ru: 'Балансировка на доске'
	};
	if (exerciseMatchesHomeKit(balanceBoard, homeBw)) {
		throw new Error('balance board must stay out of home kit');
	}
	const suspended = {
		equipment: 'body weight',
		name: 'suspended push-up',
		name_ru: 'В подвеске отжимания'
	};
	const treadmill = {
		equipment: 'body weight',
		name: 'run (equipment)',
		name_ru: 'Бег на беговой дорожке'
	};
	const platformSlide = {
		equipment: 'body weight',
		name: 'single leg platform slide',
		name_ru: 'На одной ноге платформе'
	};
	if (exerciseMatchesHomeKit(suspended, homeBw)) throw new Error('TRX suspended must stay gym');
	if (exerciseMatchesHomeKit(treadmill, homeBw)) throw new Error('treadmill must stay gym');
	if (exerciseMatchesHomeKit(platformSlide, homeBw)) throw new Error('platform slide must stay gym');
	const peacher = {
		equipment: 'dumbbell',
		name: 'dumbbell peacher hammer curl',
		name_ru: 'Скотта молотковый подъём на бицепс с гантелями'
	};
	if (exerciseMatchesHomeKit(peacher, homeDb)) throw new Error('peacher/scott curl must stay gym');
	const inclineDb = {
		equipment: 'dumbbell',
		name: 'dumbbell incline bench press',
		name_ru: 'Жим гантелей на наклонной скамье'
	};
	const standingDb = {
		equipment: 'dumbbell',
		name: 'dumbbell biceps curl',
		name_ru: 'Подъём на бицепс с гантелями'
	};
	if (exerciseMatchesHomeKit(inclineDb, homeDb)) {
		throw new Error('incline bench press must stay gym');
	}
	if (!exerciseMatchesHomeKit(standingDb, homeDb)) {
		throw new Error('standing dumbbell curl is home');
	}
	const onBall = {
		equipment: 'dumbbell',
		name: 'dumbbell bicep curl on exercise ball with leg raised',
		name_ru: 'Подъём на бицепс на фитболе с гантелями'
	};
	if (exerciseMatchesHomeKit(onBall, homeDb)) {
		throw new Error('exercise ball needs stabilityBall in kit');
	}
	if (!exerciseMatchesHomeKit(onBall, resolveHomeKitGroups(['dumbbell', 'stabilityBall']))) {
		throw new Error('exercise ball ok when stabilityBall selected');
	}
	if (!exerciseMatchesHomeKitGroup(band, 'band') || !exerciseMatchesHomeKitGroup(rb, 'band')) {
		throw new Error('band group must cover both keys');
	}
	if (!exerciseMatchesHomeKitGroup(ropeJump, 'jumpRope')) throw new Error('jump rope match');
	if (exerciseMatchesHomeKitGroup(battle, 'jumpRope')) throw new Error('battle rope must stay gym');
	if (!exerciseMatchesHomeKit(roller, resolveHomeKitGroups(['roller']))) {
		throw new Error('roller in kit');
	}
	if (exerciseMatchesHomeKit(battle, resolveHomeKitGroups(['jumpRope']))) {
		throw new Error('battle rope must not match jumpRope kit');
	}
	if (!usesExtraKgField(bw) || !usesExtraKgField(band) || !usesExtraKgField(ropeJump)) {
		throw new Error('extra kg field');
	}
	if (usesExtraKgField({ equipment: 'dumbbell', name: 'curl' })) {
		throw new Error('dumbbell is normal weight');
	}
	if (normalizeHomeKitSelection(['band', 'band', 'nope', 'bodyweight']).join() !== 'band') {
		throw new Error('normalize selection');
	}
	const stored = parseHomeKitStorage(serializeHomeKitStorage(['jumpRope', 'band']));
	if (stored.join() !== 'band,jumpRope' && stored.join() !== 'jumpRope,band') {
		if (stored.length !== 2 || !stored.includes('band') || !stored.includes('jumpRope')) {
			throw new Error(`roundtrip ${stored.join()}`);
		}
	}
	const brief = appendHomeKitToBrief('верх, 40 минут', ['band'], 'ru');
	if (!brief.includes('резинка') || !brief.includes('только оборудование')) {
		throw new Error(`brief append: ${brief}`);
	}
	if (appendHomeKitToBrief('тест', [], 'ru') !== 'тест') {
		throw new Error('empty kit must not append');
	}
}
