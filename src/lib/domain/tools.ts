/**
 * Public tool calculators (/tools/*): BMI, 1RM, calories/TDEE, heart-rate zones.
 *
 * Pure math only - no storage, no network, no Date. Web-only SEO entry points:
 * each page ends with a CTA into the sacred loop (`/builder`), it never becomes
 * a second product surface. Same module feeds Svelte pages today and can feed
 * the RN screens later without porting formulas.
 */

export type ToolId = 'one-rep-max' | 'calories' | 'bmi' | 'heart-rate-zones';

export const TOOL_IDS = [
	'one-rep-max',
	'calories',
	'bmi',
	'heart-rate-zones'
] as const satisfies readonly ToolId[];

export const TOOLS_HUB_PATH = '/tools';

export function isToolId(value: string): value is ToolId {
	return (TOOL_IDS as readonly string[]).includes(value);
}

export function toolPath(id: ToolId): string {
	return `${TOOLS_HUB_PATH}/${id}`;
}

/* ——— Shared bounds: keep parses predictable, avoid Infinity in charts/text ——— */

export const TOOL_LIMITS = {
	weightKgMin: 25,
	weightKgMax: 300,
	heightCmMin: 120,
	heightCmMax: 230,
	ageMin: 14,
	ageMax: 90,
	repsMin: 1,
	/** Brzycki breaks down past ~15 reps; 1RM estimates are noise there anyway. */
	repsMax: 15,
	liftKgMax: 500,
	restingHrMin: 35,
	restingHrMax: 110
} as const;

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
	if (!Number.isFinite(value)) return fallback;
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

/** `"82,5"` / `"82.5"` / `""` -> number clamped into [min, max]; empty -> fallback. */
export function parseToolNumber(
	raw: string | number | null | undefined,
	fallback: number,
	min: number,
	max: number
): number {
	if (raw === null || raw === undefined) return fallback;
	const text = typeof raw === 'number' ? String(raw) : raw.replace(',', '.').trim();
	if (!text) return fallback;
	const parsed = Number(text);
	return clampNumber(parsed, min, max, fallback);
}

/* ——— BMI ——— */

export type BmiCategory = 'under' | 'normal' | 'over' | 'obese';

export function calcBmi(weightKg: number, heightCm: number): number {
	if (!(weightKg > 0) || !(heightCm > 0)) return 0;
	const meters = heightCm / 100;
	return weightKg / (meters * meters);
}

export function bmiCategory(bmi: number): BmiCategory {
	if (bmi < 18.5) return 'under';
	if (bmi < 25) return 'normal';
	if (bmi < 30) return 'over';
	return 'obese';
}

/** WHO "healthy" band (18.5–24.9) for the entered height. */
export function healthyWeightRange(heightCm: number): { minKg: number; maxKg: number } {
	const meters = Math.max(heightCm, 0) / 100;
	return { minKg: 18.5 * meters * meters, maxKg: 24.9 * meters * meters };
}

/* ——— One-rep max ——— */

export type OneRepMaxEstimate = {
	epley: number;
	brzycki: number;
	lombardi: number;
	average: number;
};

/**
 * Classic 1RM estimators. All of them are only a guide: they are extrapolations
 * from a submaximal set, so we clamp reps to a sane window upstream.
 */
export function estimateOneRepMax(weightKg: number, reps: number): OneRepMaxEstimate {
	const w = Math.max(weightKg, 0);
	const r = clampNumber(reps, TOOL_LIMITS.repsMin, TOOL_LIMITS.repsMax, TOOL_LIMITS.repsMin);
	if (w === 0) return { epley: 0, brzycki: 0, lombardi: 0, average: 0 };
	const epley = w * (1 + r / 30);
	const brzycki = (w * 36) / (37 - r);
	const lombardi = w * Math.pow(r, 0.1);
	return { epley, brzycki, lombardi, average: (epley + brzycki + lombardi) / 3 };
}

export type LoadRow = {
	percent: number;
	loadKg: number;
	/** How many reps this load is usually good for (Epley inverse). */
	approxReps: number;
};

const LOAD_PERCENTS = [95, 90, 85, 80, 75, 70] as const;

/** "Рабочие веса" table under the 1RM result. */
export function loadTableForOneRepMax(oneRepMax: number): LoadRow[] {
	if (!(oneRepMax > 0)) return [];
	return LOAD_PERCENTS.map((percent) => {
		const loadKg = (oneRepMax * percent) / 100;
		const approxReps = Math.max(1, Math.round(30 * (oneRepMax / loadKg - 1)));
		return { percent, loadKg, approxReps };
	});
}

/* ——— Calories: BMR → TDEE → target + macros ——— */

export type Sex = 'male' | 'female';

export const SEXES = ['male', 'female'] as const satisfies readonly Sex[];

export type ActivityFactorId = 'sedentary' | 'light' | 'moderate' | 'high' | 'athlete';

export const ACTIVITY_FACTORS: Record<ActivityFactorId, number> = {
	sedentary: 1.2,
	light: 1.375,
	moderate: 1.55,
	high: 1.725,
	athlete: 1.9
};

export const ACTIVITY_FACTOR_IDS = [
	'sedentary',
	'light',
	'moderate',
	'high',
	'athlete'
] as const satisfies readonly ActivityFactorId[];

export type CalorieGoal = 'cut' | 'maintain' | 'gain';

export const CALORIE_GOALS = ['cut', 'maintain', 'gain'] as const satisfies readonly CalorieGoal[];

/** Mifflin–St Jeor - the formula most dietetics guidelines still prefer. */
export function calcBmrMifflin(args: {
	sex: Sex;
	weightKg: number;
	heightCm: number;
	age: number;
}): number {
	const { sex, weightKg, heightCm, age } = args;
	const base = 10 * Math.max(weightKg, 0) + 6.25 * Math.max(heightCm, 0) - 5 * Math.max(age, 0);
	return sex === 'male' ? base + 5 : base - 161;
}

export function calcTdee(bmr: number, activity: ActivityFactorId): number {
	return Math.max(bmr, 0) * (ACTIVITY_FACTORS[activity] ?? ACTIVITY_FACTORS.moderate);
}

/** ±15% / +12% - slow enough to keep strength on a cut, lean enough on a bulk. */
const GOAL_DELTA: Record<CalorieGoal, number> = {
	cut: -0.15,
	maintain: 0,
	gain: 0.12
};

export function calorieTarget(tdee: number, goal: CalorieGoal): number {
	return Math.max(tdee, 0) * (1 + GOAL_DELTA[goal]);
}

export type Macros = { proteinG: number; fatG: number; carbsG: number };

/**
 * Simple split rather than "the one true macro ratio": protein anchored to body
 * weight (1.8 g/kg), fat at 25% of calories, carbs take the rest.
 */
export function calcMacros(calories: number, weightKg: number): Macros {
	const kcal = Math.max(calories, 0);
	const proteinG = Math.min(1.8 * Math.max(weightKg, 0), (kcal * 0.35) / 4);
	const fatG = (kcal * 0.25) / 9;
	const carbsG = Math.max(0, (kcal - proteinG * 4 - fatG * 9) / 4);
	return { proteinG, fatG, carbsG };
}

/* ——— Heart-rate zones ——— */

export type HeartRateZone = {
	index: 1 | 2 | 3 | 4 | 5;
	/** Fraction of HRmax or HRreserve, e.g. 0.6 = 60%. */
	from: number;
	to: number;
	bpmFrom: number;
	bpmTo: number;
};

/** Tanaka (208 − 0.7 × age) - drifts less than 220 − age for adults. */
export function estimateMaxHeartRate(age: number): number {
	return Math.round(208 - 0.7 * Math.max(age, 0));
}

const ZONE_BOUNDS: readonly { index: 1 | 2 | 3 | 4 | 5; from: number; to: number }[] = [
	{ index: 1, from: 0.5, to: 0.6 },
	{ index: 2, from: 0.6, to: 0.7 },
	{ index: 3, from: 0.7, to: 0.8 },
	{ index: 4, from: 0.8, to: 0.9 },
	{ index: 5, from: 0.9, to: 1.0 }
];

/**
 * Zones from %HRmax, or Karvonen (%HRreserve) when resting HR is known - the
 * latter is what a watch actually uses once it has a resting value.
 */
export function heartRateZones(args: { age: number; restingHr?: number | null }): {
	maxHr: number;
	method: 'hrmax' | 'karvonen';
	zones: HeartRateZone[];
} {
	const maxHr = estimateMaxHeartRate(args.age);
	const resting = args.restingHr ?? null;
	const method: 'hrmax' | 'karvonen' = resting ? 'karvonen' : 'hrmax';
	const reserve = resting ? Math.max(maxHr - resting, 1) : 0;
	const zones = ZONE_BOUNDS.map((zone) => {
		const bpmFrom = Math.round(resting ? resting + zone.from * reserve : zone.from * maxHr);
		const bpmTo = Math.round(resting ? resting + zone.to * reserve : zone.to * maxHr);
		return { index: zone.index, from: zone.from, to: zone.to, bpmFrom, bpmTo };
	});
	return { maxHr, method, zones };
}

/* ——— Self-check (run by scripts/check-domain.mjs) ——— */

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(`tools: ${message}`);
}

export function runToolsSelfCheck(): void {
	assert(TOOL_IDS.length === 4, 'hub has four tools');
	assert(toolPath('bmi') === '/tools/bmi', 'toolPath');
	assert(!isToolId('nope'), 'isToolId rejects');

	// BMI 80 kg / 180 cm = 24.69 -> still "normal", 100 kg = 30.9 -> "obese".
	const bmi = calcBmi(80, 180);
	assert(Math.abs(bmi - 24.691) < 0.01, `bmi math ${bmi}`);
	assert(bmiCategory(bmi) === 'normal', 'bmi normal');
	assert(bmiCategory(calcBmi(55, 180)) === 'under', 'bmi under');
	assert(bmiCategory(calcBmi(85, 180)) === 'over', 'bmi over');
	assert(bmiCategory(calcBmi(100, 180)) === 'obese', 'bmi obese');
	const band = healthyWeightRange(180);
	assert(Math.abs(band.minKg - 59.9) < 0.1 && Math.abs(band.maxKg - 80.7) < 0.1, 'healthy band');
	assert(calcBmi(0, 180) === 0, 'bmi guards zero weight');

	// 100 kg × 5 reps: Epley 116.7, Brzycki 112.5, Lombardi 117.5.
	const orm = estimateOneRepMax(100, 5);
	assert(Math.abs(orm.epley - 116.667) < 0.01, `epley ${orm.epley}`);
	assert(Math.abs(orm.brzycki - 112.5) < 0.01, `brzycki ${orm.brzycki}`);
	assert(Math.abs(orm.lombardi - 117.462) < 0.01, `lombardi ${orm.lombardi}`);
	assert(estimateOneRepMax(0, 5).average === 0, 'orm guards zero weight');
	const single = estimateOneRepMax(100, 1);
	assert(single.epley > 100 && single.brzycki === 100, 'single is close to the lifted weight');
	const loads = loadTableForOneRepMax(100);
	assert(loads.length === 6 && loads[0].percent === 95, 'load table shape');
	assert(loads[0].loadKg === 95 && loads[5].loadKg === 70, 'load table math');
	assert(loads[5].approxReps > loads[0].approxReps, 'lighter load -> more reps');
	assert(loadTableForOneRepMax(0).length === 0, 'load table guards zero');

	// Mifflin male 80 kg / 180 cm / 30 y = 800 + 1125 - 150 + 5 = 1780.
	assert(calcBmrMifflin({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 }) === 1780, 'bmr male');
	assert(
		calcBmrMifflin({ sex: 'female', weightKg: 80, heightCm: 180, age: 30 }) === 1614,
		'bmr female'
	);
	assert(calcTdee(1780, 'moderate') === 2759, 'tdee moderate');
	assert(Math.round(calorieTarget(2759, 'cut')) === 2345, 'cut target');
	assert(Math.round(calorieTarget(2759, 'maintain')) === 2759, 'maintain target');
	assert(Math.round(calorieTarget(2759, 'gain')) === 3090, 'gain target');
	const macros = calcMacros(2759, 80);
	assert(Math.round(macros.proteinG) === 144, `protein ${macros.proteinG}`);
	assert(Math.abs(macros.proteinG * 4 + macros.fatG * 9 + macros.carbsG * 4 - 2759) < 1, 'macros sum');

	// 40 y -> HRmax 180; %HRmax zones.
	const hrmax = heartRateZones({ age: 40 });
	assert(hrmax.maxHr === 180 && hrmax.method === 'hrmax', 'hrmax method');
	assert(hrmax.zones[0].bpmFrom === 90 && hrmax.zones[4].bpmTo === 180, 'hrmax zone edges');
	let ordered = true;
	for (let i = 1; i < hrmax.zones.length; i++) {
		if (hrmax.zones[i].bpmFrom < hrmax.zones[i - 1].bpmTo) ordered = false;
	}
	assert(ordered, 'zones ordered');
	// Karvonen with 60 bpm resting: reserve 120 -> zone 1 starts at 120.
	const karvonen = heartRateZones({ age: 40, restingHr: 60 });
	assert(karvonen.method === 'karvonen', 'karvonen method');
	assert(karvonen.zones[0].bpmFrom === 120, `karvonen zone1 ${karvonen.zones[0].bpmFrom}`);
	assert(karvonen.zones[4].bpmTo === 180, 'karvonen tops at max');

	assert(parseToolNumber('82,5', 70, 25, 300) === 82.5, 'parse comma decimal');
	assert(parseToolNumber('', 70, 25, 300) === 70, 'parse empty -> fallback');
	assert(parseToolNumber('999', 70, 25, 300) === 300, 'parse clamps high');
	assert(parseToolNumber('-5', 70, 25, 300) === 25, 'parse clamps low');
}
