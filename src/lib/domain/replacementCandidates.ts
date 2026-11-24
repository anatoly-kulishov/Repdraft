/**
 * «Умный подбор замены»: rank catalog exercises as substitutes for the one the
 * athlete is about to swap. Pure and client-agnostic, so the RN screen can reuse
 * the exact same order later.
 *
 * Signals (why a lift is a good substitute, strongest first):
 * - same `target` — the primary muscle the exercise trains. Alone it outweighs
 *   every other signal combined, so a hugely popular lift from another zone can
 *   never lead the list;
 * - same `body_part` — same zone, so a chest day stays a chest day;
 * - shared `secondary_muscles` — same supporting pattern (press → triceps);
 * - `globalPopularity` — how common the lift is, which is what spreads the head of
 *   the list across distinct movements (bench → dips → push-ups) instead of ten
 *   near-identical barbell-press variants.
 *
 * Tie-breakers (small on purpose — they only reorder lifts that already match on
 * the signals above):
 * - same implement family — «штанга → штанга» reads as the same movement;
 * - home kit — when the athlete trains at home, gear they don't own ranks down
 *   (a band shrug should not be swapped for a barbell shrug);
 * - already trained — a lift from their own history is an easy yes;
 * - not already in today's session — never offer what the workout already has.
 *
 * Near-identical catalog entries («Шраги вниз головой с гантелями» and its
 * «(вариант 2)») are demoted to the tail: two rows of the same movement waste the
 * first screen, which is the only one an athlete reads mid-set.
 *
 * A zone is often wider than one muscle: «Руки» carries biceps, triceps and
 * forearms. Ranked purely by `target`, the head of the list is one muscle only and
 * the rest of the picked zone looks missing (`capPerTargetInZone` below fixes it).
 */
import {
	exerciseMatchesHomeKit,
	resolveHomeKitGroups,
	type HomeKitGroupId
} from './homeKit';
import type { ExerciseIndexItem } from './types';

export type ReplacementSeed = Pick<ExerciseIndexItem, 'id' | 'body_part' | 'target'> & {
	/** Optional: a partial seed (or an old cached index) may not carry it. */
	readonly secondary_muscles?: readonly string[];
	/** Optional: the implement being swapped away. */
	readonly equipment?: string;
};

export type ReplacementCandidate = {
	item: ExerciseIndexItem;
	score: number;
	/** Which signals fired, in weight order (QA / future “почему” hints). */
	signals: ReplacementSignal[];
};

export type ReplacementSignal =
	| 'target'
	| 'body_part'
	| 'secondary'
	| 'equipment'
	| 'home'
	| 'familiar'
	| 'popular'
	| 'gear-missing';

export type ReplacementOptions = {
	limit?: number;
	capPerTargetInZone?: number;
	/** Ids already in the session/plan: never offered as a swap. */
	excludeIds?: Iterable<string>;
	/** Lifts the athlete already trains (frequent history ids). */
	familiarIds?: Iterable<string>;
	/** Home gear groups. Only pass them when the athlete really trains at home. */
	homeKit?: readonly string[] | null;
};

const WEIGHT_TARGET = 40;
const WEIGHT_BODY_PART = 12;
const WEIGHT_SECONDARY = 2;
const SECONDARY_CAP = 8;
const WEIGHT_POPULARITY = 8;
/* Tie-breakers: the sum of every same-zone extra stays under WEIGHT_TARGET (38). */
const WEIGHT_EQUIPMENT = 3;
const WEIGHT_HOME_FIT = 4;
const WEIGHT_FAMILIAR = 3;
const WEIGHT_GEAR_MISSING = -4;

type ScoreContext = {
	familiar: ReadonlySet<string>;
	kit: readonly HomeKitGroupId[] | null;
};

const EMPTY_CONTEXT: ScoreContext = { familiar: new Set(), kit: null };

function muscleSet(seed: ReplacementSeed): Set<string> {
	const own = [seed.target, ...(seed.secondary_muscles ?? [])];
	return new Set(own.filter(Boolean));
}

/** «штанга», «ez-штанга» и «олимпийская штанга» are the same swap in practice. */
export function equipmentFamily(value: string | null | undefined): string {
	const key = (value ?? '').trim().toLowerCase();
	if (key === 'resistance band') return 'band';
	if (key === 'leverage machine' || key === 'smith machine') return 'machine';
	if (key === 'ez barbell' || key === 'olympic barbell' || key === 'trap bar') return 'barbell';
	return key;
}

/**
 * Catalog variant markers that never change the movement: another photo, another
 * gender model, or an export duplicate. Dropped so both rows share one family key.
 */
const VARIANT_MARKER =
	/\((?:вариант|variant|v\.)\s*\d+\)|\(другой ракурс\)|\(other angle\)|\(вид сзади\)|\(back pov\)|\(вид сбоку\)|\(side pov\)|\((?:male|female|жен\.|муж\.)\)|\bv\.\s*\d+$/gi;

/** Same physical movement across catalog duplicates; case/space insensitive. */
export function movementFamily(item: Pick<ExerciseIndexItem, 'name' | 'name_ru'>): string {
	const base = item.name_ru || item.name;
	return base.replace(VARIANT_MARKER, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** `true` for an export/photo duplicate («… (вариант 2)»), so the base row leads. */
function isCatalogVariant(item: Pick<ExerciseIndexItem, 'name' | 'name_ru'>): boolean {
	const base = item.name_ru || item.name;
	return base.replace(VARIANT_MARKER, ' ') !== base;
}

/** 0–100-ish relevance of `item` as a substitute for `seed`. */
export function replacementCandidateScore(
	item: ExerciseIndexItem,
	seed: ReplacementSeed,
	seedMuscles = muscleSet(seed),
	context: ScoreContext = EMPTY_CONTEXT
): ReplacementCandidate {
	if (item.id === seed.id) return { item, score: -1, signals: [] };

	const signals: ReplacementSignal[] = [];
	let score = 0;

	if (item.target === seed.target) {
		score += WEIGHT_TARGET;
		signals.push('target');
	}
	if (item.body_part === seed.body_part) {
		score += WEIGHT_BODY_PART;
		signals.push('body_part');
	}
	let shared = 0;
	for (const muscle of item.secondary_muscles ?? []) {
		if (seedMuscles.has(muscle)) shared += 1;
	}
	if (shared > 0) {
		score += Math.min(shared * WEIGHT_SECONDARY, SECONDARY_CAP);
		signals.push('secondary');
	}

	const seedGear = equipmentFamily(seed.equipment);
	if (seedGear && equipmentFamily(item.equipment) === seedGear) {
		score += WEIGHT_EQUIPMENT;
		signals.push('equipment');
	}
	if (context.kit) {
		if (exerciseMatchesHomeKit(item, context.kit)) {
			score += WEIGHT_HOME_FIT;
			signals.push('home');
		} else {
			score += WEIGHT_GEAR_MISSING;
			signals.push('gear-missing');
		}
	}
	if (context.familiar.has(item.id)) {
		score += WEIGHT_FAMILIAR;
		signals.push('familiar');
	}

	const popularity = Math.max(0, Math.min(100, item.globalPopularity ?? 0));
	if (popularity > 0) {
		score += (popularity / 100) * WEIGHT_POPULARITY;
		signals.push('popular');
	}

	return { item, score, signals };
}

/**
 * Best substitutes first. The seed itself is never returned; ties go to the more
 * popular lift, then to the stable id so the order never flickers between renders.
 *
 * `capPerTargetInZone` keeps one muscle from eating its whole zone: after that many
 * substitutes with the seed's zone *and* target, the list moves on to the next
 * muscle of the same zone (biceps → triceps in «Руки»). Zones with a single target
 * (chest = pectorals) are untouched, so a chest swap never leaks into shoulders.
 *
 * Catalog duplicates of one movement («… (вариант 2)») are pushed behind the first
 * one — the athlete reads the first screen, not the fortieth row.
 */
export function rankReplacementCandidates(
	items: readonly ExerciseIndexItem[],
	seed: ReplacementSeed,
	opts: ReplacementOptions = {}
): ReplacementCandidate[] {
	const seedMuscles = muscleSet(seed);
	const limit = Math.max(0, opts.limit ?? Number.POSITIVE_INFINITY);
	const cap = Math.max(1, opts.capPerTargetInZone ?? 3);

	const excluded = new Set(opts.excludeIds ?? []);
	excluded.add(seed.id);
	const familiarIds = opts.familiarIds;
	const context: ScoreContext = {
		familiar: new Set(familiarIds ?? []),
		kit: opts.homeKit?.length ? resolveHomeKitGroups(opts.homeKit) : null
	};

	const zoneTargets = new Set(
		items.filter((item) => item.body_part === seed.body_part).map((item) => item.target)
	);
	/** One muscle, one zone: nothing to spread, keep pure relevance order. */
	const spread = zoneTargets.size > 1;

	const sorted = items
		.filter((item) => !excluded.has(item.id))
		.map((item) => replacementCandidateScore(item, seed, seedMuscles, context))
		.sort(
			(a, b) =>
				b.score - a.score ||
				(b.item.globalPopularity ?? 0) - (a.item.globalPopularity ?? 0) ||
				Number(isCatalogVariant(a.item)) - Number(isCatalogVariant(b.item)) ||
				a.item.id.localeCompare(b.item.id)
		);

	const head: ReplacementCandidate[] = [];
	const overflow: ReplacementCandidate[] = [];
	const perTarget = new Map<string, number>();
	const families = new Set<string>();
	for (const row of sorted) {
		const sameZone = row.item.body_part === seed.body_part;
		const family = movementFamily(row.item);
		const used = perTarget.get(row.item.target) ?? 0;
		if (families.has(family) || (spread && sameZone && used >= cap)) {
			overflow.push(row);
			continue;
		}
		families.add(family);
		if (sameZone) perTarget.set(row.item.target, used + 1);
		head.push(row);
		if (head.length >= limit) break;
	}
	return head.length >= limit ? head.slice(0, limit) : [...head, ...overflow];
}

/** Same order, items only — the shape the picker list wants. */
export function replacementCandidateItems(
	items: readonly ExerciseIndexItem[],
	seed: ReplacementSeed,
	opts: ReplacementOptions = {}
): ExerciseIndexItem[] {
	return rankReplacementCandidates(items, seed, opts).map((row) => row.item);
}

export function runReplacementCandidatesSelfCheck(): void {
	const seed: ReplacementSeed = {
		id: 'press-bb',
		body_part: 'chest',
		target: 'pectorals',
		equipment: 'barbell',
		secondary_muscles: ['triceps', 'shoulders']
	};

	const item = (
		id: string,
		body_part: string,
		target: string,
		equipment: string,
		secondary: string[],
		popularity = 0,
		name = id
	): ExerciseIndexItem => ({
		id,
		name,
		body_part,
		target,
		equipment,
		secondary_muscles: secondary,
		muscle_group: target,
		image: '',
		globalPopularity: popularity
	});

	const catalog = [
		item(seed.id, 'chest', 'pectorals', 'barbell', ['triceps']),
		// Same target + zone + supporting muscle, but other implement.
		item('press-db', 'chest', 'pectorals', 'dumbbell', ['triceps'], 30),
		// Same target + zone, no supporting overlap.
		item('press-machine', 'chest', 'pectorals', 'machine', [], 10),
		// Same target + zone + overlapping muscles, and very popular.
		item('pushup', 'chest', 'pectorals', 'body weight', ['triceps'], 95),
		// Other zone, other muscle.
		item('row-bb', 'back', 'lats', 'barbell', ['biceps'], 20),
		// Other zone, other muscle, hugely popular.
		item('squat', 'upper legs', 'quads', 'barbell', [], 100)
	];

	const ranked = rankReplacementCandidates(catalog, seed);
	if (ranked.some((row) => row.item.id === seed.id)) {
		throw new Error('replacementCandidates: seed must be excluded');
	}
	if (ranked.length !== catalog.length - 1) {
		throw new Error('replacementCandidates: every other item must survive');
	}
	// A target match (40) always beats every other combination (max 12+8+8=28),
	// so hugely popular lifts from another zone never lead the swap list.
	const firstNonTarget = ranked.findIndex((row) => !row.signals.includes('target'));
	if (firstNonTarget !== 3) {
		throw new Error('replacementCandidates: target matches must come first');
	}
	const order = ranked.map((row) => row.item.id);
	// Popularity only breaks near-ties: same signals, more popular wins.
	if (!(order.indexOf('pushup') < order.indexOf('press-db'))) {
		throw new Error('replacementCandidates: popularity tie-break (target)');
	}
	if (!(order.indexOf('squat') < order.indexOf('row-bb'))) {
		throw new Error('replacementCandidates: popularity tie-break (same score shape)');
	}
	if (order.indexOf('press-machine') < order.indexOf('press-db')) {
		throw new Error('replacementCandidates: fewer shared muscles must not win');
	}

	const tie = rankReplacementCandidates(
		[
			item('a', 'chest', 'pectorals', 'barbell', [], 5),
			item('b', 'chest', 'pectorals', 'barbell', [], 80)
		],
		seed
	);
	if (tie[0]?.item.id !== 'b') throw new Error('replacementCandidates: popularity tie-break (flat)');
	// Stable order for identical scores.
	const stable = rankReplacementCandidates(
		[
			item('z', 'chest', 'pectorals', 'barbell', []),
			item('y', 'chest', 'pectorals', 'barbell', [])
		],
		seed
	);
	if (stable.map((row) => row.item.id).join(',') !== 'y,z') {
		throw new Error('replacementCandidates: deterministic tie order');
	}
	if (replacementCandidateItems(catalog, seed, { limit: 2 }).length !== 2) {
		throw new Error('replacementCandidates: limit');
	}

	// A zone wider than one muscle («Руки» = biceps + triceps) must not turn into a
	// biceps-only list: after the cap, the list moves on to the next muscle of the zone.
	const armSeed: ReplacementSeed = {
		id: 'curl-bb',
		body_part: 'upper arms',
		target: 'biceps brachii',
		secondary_muscles: ['forearms']
	};
	const arms = [
		item(armSeed.id, 'upper arms', 'biceps brachii', 'barbell', ['forearms'], 60),
		item('curl-db', 'upper arms', 'biceps brachii', 'dumbbell', ['forearms'], 55),
		item('curl-machine', 'upper arms', 'biceps brachii', 'machine', [], 40),
		item('curl-cable', 'upper arms', 'biceps brachii', 'cable', [], 30),
		item('curl-hammer', 'upper arms', 'biceps brachii', 'dumbbell', [], 20),
		item('triceps-pushdown', 'upper arms', 'triceps brachii', 'cable', [], 70),
		item('triceps-dip', 'upper arms', 'triceps brachii', 'body weight', [], 50),
		item('wrist-curl', 'upper arms', 'forearms', 'dumbbell', [], 10),
		item('bench', 'chest', 'pectorals', 'barbell', [], 90)
	];
	const armRanked = replacementCandidateItems(arms, armSeed);
	const armIndex = (id: string) => armRanked.findIndex((row) => row.id === id);
	const bicepsBeforeTriceps = armRanked
		.slice(0, Math.max(0, armIndex('triceps-pushdown')))
		.filter((row) => row.target === 'biceps brachii').length;
	if (bicepsBeforeTriceps > 3) {
		throw new Error('replacementCandidates: one muscle must not eat its zone');
	}
	if (!(armIndex('triceps-pushdown') > armIndex('curl-db'))) {
		throw new Error('replacementCandidates: closest substitute still leads');
	}
	if (armIndex('triceps-pushdown') > 3) {
		throw new Error('replacementCandidates: the rest of the zone must show up early');
	}
	if (!(armIndex('bench') > armIndex('wrist-curl'))) {
		throw new Error('replacementCandidates: same zone outranks another zone');
	}
	// Completeness survives the spread: every other item is still somewhere in the list.
	if (armRanked.length !== arms.length - 1) {
		throw new Error('replacementCandidates: spread keeps every candidate');
	}
	// A single-target zone keeps the plain relevance order.
	const chestRanked = replacementCandidateItems(catalog, seed);
	if (chestRanked.length !== catalog.length - 1) {
		throw new Error('replacementCandidates: single-target zone keeps order');
	}
	// Missing secondary muscles / equipment must not throw.
	rankReplacementCandidates(
		[item('x', 'chest', 'pectorals', 'barbell', [])],
		{ ...seed, secondary_muscles: undefined, equipment: undefined }
	);

	// Catalog duplicates of one movement: the base row leads, the «вариант 2» tail.
	const duplicates = [
		item('shrug-var', 'back', 'traps', 'dumbbell', [], 25, 'Шраги вниз головой с гантелями (вариант 2)'),
		item('shrug', 'back', 'traps', 'dumbbell', [], 25, 'Шраги вниз головой с гантелями'),
		item('pullup', 'back', 'lats', 'body weight', [], 25, 'Подтягивания на перекладине')
	];
	const shrugSeed: ReplacementSeed = {
		id: 'band-shrug',
		body_part: 'back',
		target: 'traps',
		equipment: 'band'
	};
	const deduped = replacementCandidateItems(duplicates, shrugSeed);
	if (deduped.length !== duplicates.length) {
		throw new Error('replacementCandidates: duplicate demotion keeps every candidate');
	}
	if (deduped[0]?.id !== 'shrug') {
		throw new Error('replacementCandidates: the base movement leads its duplicates');
	}
	// Both shrug rows share one family, so the second one leaves the head.
	if (deduped[1]?.id === 'shrug-var') {
		throw new Error('replacementCandidates: variant must not sit next to its base row');
	}

	// Same implement family is a tie-breaker, not a driver: the seed's gear wins
	// over an equally scored lift on other gear.
	const gearSeed: ReplacementSeed = {
		id: 'seed',
		body_part: 'back',
		target: 'traps',
		equipment: 'barbell'
	};
	const gearRanked = replacementCandidateItems(
		[
			item('db', 'back', 'traps', 'dumbbell', [], 25),
			item('bb', 'back', 'traps', 'ez barbell', [], 25)
		],
		gearSeed
	);
	if (gearRanked[0]?.id !== 'bb') {
		throw new Error('replacementCandidates: same implement family must lead');
	}

	// Home kit: gear the athlete owns outranks unavailable gear.
	const homeRanked = replacementCandidateItems(
		[
			item('barbell-shrug', 'back', 'traps', 'barbell', [], 80),
			item('db-shrug', 'back', 'traps', 'dumbbell', [], 20)
		],
		shrugSeed,
		{ homeKit: ['dumbbell'] }
	);
	if (homeRanked[0]?.id !== 'db-shrug') {
		throw new Error('replacementCandidates: home gear must beat unavailable gear');
	}
	// No kit passed = gym default: popularity keeps the barbell row on top.
	if (replacementCandidateItems(
		[
			item('barbell-shrug', 'back', 'traps', 'barbell', [], 80),
			item('db-shrug', 'back', 'traps', 'dumbbell', [], 20)
		],
		shrugSeed
	)[0]?.id !== 'barbell-shrug') {
		throw new Error('replacementCandidates: no kit must not filter the gym catalog');
	}

	// Today's session is never offered as a swap of itself.
	const excluded = replacementCandidateItems(catalog, seed, { excludeIds: ['press-db'] });
	if (excluded.some((row) => row.id === 'press-db')) {
		throw new Error('replacementCandidates: excludeIds');
	}
	// A lift from the athlete's own history wins a flat tie.
	const familiarRanked = replacementCandidateItems(
		[
			item('aaa-unused', 'chest', 'pectorals', 'barbell', [], 25),
			item('zzz-trained', 'chest', 'pectorals', 'barbell', [], 25)
		],
		seed,
		{ familiarIds: ['zzz-trained'] }
	);
	if (familiarRanked[0]?.id !== 'zzz-trained') {
		throw new Error('replacementCandidates: familiar lift must win a tie');
	}
}
