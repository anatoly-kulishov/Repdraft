#!/usr/bin/env node
/**
 * Rebuilds slim catalog index from the server-only full catalog.
 * Usage: npm run build:data
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root, 'data/exercises.full.json');
const indexPath = path.join(root, 'static/data/exercises.index.json');

if (!fs.existsSync(sourcePath)) {
	console.error(`Missing ${sourcePath}`);
	process.exit(1);
}

const full = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
if (!Array.isArray(full)) {
	console.error('exercises.full.json must be an array');
	process.exit(1);
}

/**
 * TOP gym staples: each rule claims at most one exercise (shortest matching name).
 * Scores 80–100 for cold-start “Popular in the gym”.
 */
const TOP_RULES = [
	{ score: 100, re: /\bbarbell bench press\b/i, exclude: /band|smith|close-grip|reverse|incline|decline|guillotine/i },
	{ score: 99, re: /\bbarbell (full )?squat\b/i, exclude: /band|hack|jefferson|split|front|zercher|overhead|bench|jump/i },
	{ score: 98, re: /\bbarbell deadlift\b/i, exclude: /band|stiff|romanian|sumo|deficit|snatch|one arm/i },
	{ score: 97, re: /\bpull[- ]?ups?\b/i, exclude: /band|assisted|weighted|archer|commando|kipping|muscle|bench|parallel|close/i },
	{ score: 96, re: /\bbarbell standing (wide )?military press\b|\bdumbbell standing overhead press\b/i, exclude: /band|behind|alternate|kettlebell|close grip/i },
	{ score: 95, re: /\bbarbell bent over row\b|\bbarbell pendlay row\b/i, exclude: /band|upright|incline|rear delt/i },
	{ score: 94, re: /\bbarbell romanian deadlift\b/i, exclude: /band/i },
	{ score: 93, re: /^barbell lunge$/i, exclude: /band|lateral|rear|walking/i },
	{ score: 92, re: /\bhip thrust/i, exclude: /band|kneeling|resistance/i },
	{ score: 91, re: /^chest dip$/i, exclude: /band|assisted|kneeling|ring|bench|cage|straight/i },
	{ score: 90, re: /^chin-up$/i, exclude: /band|assisted|weighted|narrow|close|gorilla|gironda/i },
	{ score: 89, re: /\bbarbell incline bench press\b/i, exclude: /band|smith|dumbbell|reverse/i },
	{ score: 88, re: /\bcable lat pulldown\b|\blat pulldown\b/i, exclude: /reverse|twin|full range|one arm/i },
	{ score: 87, re: /^push-up$|^push up$/i, exclude: /band|clap|archer|diamond|pike|wide|close|knee/i },
	{ score: 86, re: /^leg press$|\bsled (45° )?leg press\b/i, exclude: /calf|alternate|one leg|hack/i },
	{ score: 85, re: /^dumbbell lateral raise$/i, exclude: /band|front|cable|incline|rear/i },
	{ score: 84, re: /\bcable rear delt row \(with rope\)/i, exclude: /band|kneeling|standing/i },
	{ score: 83, re: /^front plank$|^plank$/i, exclude: /side|twist|fly|incline|kneeling|power|shoulder/i },
	{ score: 82, re: /^barbell curl$/i, exclude: /band|concentration|preacher|hammer|cable|alternate|blaster|wrist|reverse|biceps/i },
	{ score: 81, re: /\bbarbell lying triceps extension skull crusher\b|^barbell lying triceps extension$/i, exclude: /band|cable|one arm|close-grip|seated|standing|assisted/i },
	{ score: 80, re: /\bbarbell standing calf raise\b|^standing calf raise$/i, exclude: /band|single|seated|donkey/i },
	{ score: 80, re: /^barbell shrug$/i, exclude: /band|cable|dumbbell/i },
	{ score: 80, re: /^dumbbell one arm row$|^dumbbell bent over row$/i, exclude: /band|incline|alternate|rear delt/i },
	{ score: 80, re: /\blever (lying )?leg curl\b|^leg extension$|\blever leg extension\b/i, exclude: /band|seated one|inverse/i },
	{ score: 80, re: /^barbell front squat$/i, exclude: /band|dumbbell|goblet|bench/i }
];

const ISOLATION_RE =
	/\b(cable|machine|lever|band|isolation|concentration|kickback|fly|flye|pec deck)\b/i;

const topById = new Map();
const claimedIds = new Set();

for (const rule of TOP_RULES) {
	const candidates = [];
	for (const ex of full) {
		const name = String(ex.name ?? '');
		if (claimedIds.has(ex.id)) continue;
		if (!rule.re.test(name)) continue;
		if (rule.exclude?.test(name)) continue;
		candidates.push(ex);
	}
	candidates.sort((a, b) => String(a.name).length - String(b.name).length);
	const pick = candidates[0];
	if (!pick) continue;
	topById.set(pick.id, rule.score);
	claimedIds.add(pick.id);
}

function assignPopularity(ex) {
	const top = topById.get(ex.id);
	if (top != null) return top;

	const name = String(ex.name ?? '');
	const equipment = String(ex.equipment ?? '').toLowerCase();
	const secondary = Array.isArray(ex.secondary_muscles) ? ex.secondary_muscles.length : 0;
	if (ISOLATION_RE.test(name) || equipment.includes('cable') || equipment.includes('leverage machine')) {
		return secondary > 2 ? 35 : 20;
	}
	if (equipment.includes('band') || equipment.includes('assisted')) return 15;
	return 25;
}

const index = full.map((ex) => ({
	id: ex.id,
	name: ex.name,
	name_ru: ex.name_ru,
	body_part: ex.body_part,
	equipment: ex.equipment,
	target: ex.target,
	muscle_group: ex.muscle_group,
	secondary_muscles: ex.secondary_muscles,
	image: ex.image,
	globalPopularity: Math.min(100, Math.max(1, assignPopularity(ex)))
}));

const topCount = index.filter((ex) => ex.globalPopularity >= 80).length;
const topNames = index
	.filter((ex) => ex.globalPopularity >= 80)
	.sort((a, b) => b.globalPopularity - a.globalPopularity)
	.map((ex) => `${ex.globalPopularity}:${ex.name}`)
	.slice(0, 30);

fs.mkdirSync(path.dirname(indexPath), { recursive: true });
fs.writeFileSync(indexPath, JSON.stringify(index));
console.log(
	`Wrote ${index.length} index rows → ${path.relative(root, indexPath)} (${topCount} with popularity ≥80)`
);
console.log(topNames.join(' | '));
