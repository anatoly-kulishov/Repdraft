export type SlotRole = 'heavy_compound' | 'compound' | 'isolation';

export type TemplateSlot = {
	role: SlotRole;
	bodyPart: string;
	sets: [number, number];
	reps: [number, number];
	restSec: [number, number];
};

export type SplitTemplate = {
	id: string;
	labelRu: string;
	labelEn: string;
	/** Catalog body_part values that vote for this split. */
	triggerParts: string[];
	slots: TemplateSlot[];
};

export const SPLIT_TEMPLATES: SplitTemplate[] = [
	{
		id: 'push',
		labelRu: 'Жимовой день',
		labelEn: 'Push day',
		triggerParts: ['chest', 'shoulders', 'upper arms'],
		slots: [
			{ role: 'heavy_compound', bodyPart: 'chest', sets: [4, 4], reps: [5, 8], restSec: [120, 180] },
			{ role: 'compound', bodyPart: 'chest', sets: [3, 4], reps: [8, 12], restSec: [90, 120] },
			{ role: 'compound', bodyPart: 'shoulders', sets: [3, 3], reps: [8, 12], restSec: [90, 120] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [3, 3], reps: [10, 15], restSec: [45, 75] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [2, 3], reps: [10, 15], restSec: [45, 75] }
		]
	},
	{
		id: 'pull',
		labelRu: 'Тяговый день',
		labelEn: 'Pull day',
		triggerParts: ['back', 'upper arms'],
		slots: [
			{ role: 'heavy_compound', bodyPart: 'back', sets: [4, 4], reps: [5, 8], restSec: [120, 180] },
			{ role: 'compound', bodyPart: 'back', sets: [3, 4], reps: [8, 12], restSec: [90, 120] },
			{ role: 'compound', bodyPart: 'back', sets: [3, 3], reps: [8, 12], restSec: [90, 120] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [3, 3], reps: [10, 15], restSec: [45, 75] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [2, 3], reps: [10, 15], restSec: [45, 75] }
		]
	},
	{
		id: 'legs',
		labelRu: 'Ноги',
		labelEn: 'Legs',
		triggerParts: ['upper legs', 'lower legs'],
		slots: [
			{ role: 'heavy_compound', bodyPart: 'upper legs', sets: [4, 5], reps: [5, 8], restSec: [150, 180] },
			{ role: 'compound', bodyPart: 'upper legs', sets: [3, 4], reps: [8, 12], restSec: [90, 120] },
			{ role: 'compound', bodyPart: 'upper legs', sets: [3, 3], reps: [8, 12], restSec: [90, 120] },
			{ role: 'isolation', bodyPart: 'upper legs', sets: [3, 3], reps: [10, 15], restSec: [45, 75] },
			{ role: 'isolation', bodyPart: 'lower legs', sets: [3, 3], reps: [12, 20], restSec: [45, 60] }
		]
	},
	{
		id: 'upper',
		labelRu: 'Верх тела',
		labelEn: 'Upper body',
		triggerParts: ['chest', 'back', 'shoulders', 'upper arms'],
		slots: [
			{ role: 'heavy_compound', bodyPart: 'chest', sets: [4, 4], reps: [5, 8], restSec: [120, 180] },
			{ role: 'heavy_compound', bodyPart: 'back', sets: [4, 4], reps: [5, 8], restSec: [120, 180] },
			{ role: 'compound', bodyPart: 'shoulders', sets: [3, 3], reps: [8, 12], restSec: [90, 120] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [3, 3], reps: [10, 15], restSec: [45, 75] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [2, 3], reps: [10, 15], restSec: [45, 75] }
		]
	},
	{
		id: 'lower',
		labelRu: 'Низ тела',
		labelEn: 'Lower body',
		triggerParts: ['upper legs', 'lower legs', 'waist'],
		slots: [
			{ role: 'heavy_compound', bodyPart: 'upper legs', sets: [4, 5], reps: [5, 8], restSec: [150, 180] },
			{ role: 'compound', bodyPart: 'upper legs', sets: [3, 4], reps: [8, 12], restSec: [90, 120] },
			{ role: 'compound', bodyPart: 'upper legs', sets: [3, 3], reps: [8, 12], restSec: [90, 120] },
			{ role: 'isolation', bodyPart: 'lower legs', sets: [3, 3], reps: [12, 20], restSec: [45, 60] },
			{ role: 'isolation', bodyPart: 'waist', sets: [2, 3], reps: [12, 20], restSec: [30, 60] }
		]
	},
	{
		id: 'fullbody',
		labelRu: 'Всё тело',
		labelEn: 'Full body',
		triggerParts: ['chest', 'back', 'shoulders', 'upper arms', 'upper legs', 'lower legs', 'waist'],
		slots: [
			{ role: 'heavy_compound', bodyPart: 'upper legs', sets: [4, 4], reps: [5, 8], restSec: [120, 180] },
			{ role: 'heavy_compound', bodyPart: 'chest', sets: [3, 4], reps: [5, 8], restSec: [120, 180] },
			{ role: 'heavy_compound', bodyPart: 'back', sets: [3, 4], reps: [5, 8], restSec: [120, 180] },
			{ role: 'compound', bodyPart: 'shoulders', sets: [3, 3], reps: [8, 12], restSec: [90, 120] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [2, 3], reps: [10, 15], restSec: [45, 75] },
			{ role: 'isolation', bodyPart: 'waist', sets: [2, 3], reps: [12, 20], restSec: [30, 60] }
		]
	},
	{
		id: 'arms',
		labelRu: 'Руки',
		labelEn: 'Arms',
		triggerParts: ['upper arms'],
		slots: [
			{ role: 'compound', bodyPart: 'upper arms', sets: [3, 4], reps: [8, 12], restSec: [60, 90] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [3, 3], reps: [10, 15], restSec: [45, 75] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [3, 3], reps: [10, 15], restSec: [45, 75] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [2, 3], reps: [10, 15], restSec: [45, 75] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [2, 3], reps: [12, 15], restSec: [45, 60] }
		]
	},
	{
		id: 'shoulders',
		labelRu: 'Плечи',
		labelEn: 'Shoulders',
		triggerParts: ['shoulders'],
		slots: [
			{ role: 'heavy_compound', bodyPart: 'shoulders', sets: [4, 4], reps: [5, 8], restSec: [120, 150] },
			{ role: 'compound', bodyPart: 'shoulders', sets: [3, 3], reps: [8, 12], restSec: [90, 120] },
			{ role: 'isolation', bodyPart: 'shoulders', sets: [3, 3], reps: [10, 15], restSec: [45, 75] },
			{ role: 'isolation', bodyPart: 'shoulders', sets: [2, 3], reps: [12, 15], restSec: [45, 60] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [2, 3], reps: [10, 15], restSec: [45, 75] }
		]
	},
	{
		id: 'chest',
		labelRu: 'Грудь',
		labelEn: 'Chest',
		triggerParts: ['chest'],
		slots: [
			{ role: 'heavy_compound', bodyPart: 'chest', sets: [4, 4], reps: [5, 8], restSec: [120, 180] },
			{ role: 'compound', bodyPart: 'chest', sets: [3, 4], reps: [8, 12], restSec: [90, 120] },
			{ role: 'compound', bodyPart: 'chest', sets: [3, 3], reps: [8, 12], restSec: [90, 120] },
			{ role: 'isolation', bodyPart: 'chest', sets: [3, 3], reps: [10, 15], restSec: [45, 75] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [2, 3], reps: [10, 15], restSec: [45, 75] }
		]
	},
	{
		id: 'back',
		labelRu: 'Спина',
		labelEn: 'Back',
		triggerParts: ['back'],
		slots: [
			{ role: 'heavy_compound', bodyPart: 'back', sets: [4, 4], reps: [5, 8], restSec: [120, 180] },
			{ role: 'compound', bodyPart: 'back', sets: [3, 4], reps: [8, 12], restSec: [90, 120] },
			{ role: 'compound', bodyPart: 'back', sets: [3, 3], reps: [8, 12], restSec: [90, 120] },
			{ role: 'isolation', bodyPart: 'back', sets: [3, 3], reps: [10, 15], restSec: [45, 75] },
			{ role: 'isolation', bodyPart: 'upper arms', sets: [2, 3], reps: [10, 15], restSec: [45, 75] }
		]
	},
	{
		id: 'core',
		labelRu: 'Кор',
		labelEn: 'Core',
		triggerParts: ['waist'],
		slots: [
			{ role: 'compound', bodyPart: 'waist', sets: [3, 3], reps: [12, 20], restSec: [30, 60] },
			{ role: 'isolation', bodyPart: 'waist', sets: [3, 3], reps: [12, 20], restSec: [30, 60] },
			{ role: 'isolation', bodyPart: 'waist', sets: [2, 3], reps: [12, 20], restSec: [30, 45] },
			{ role: 'isolation', bodyPart: 'waist', sets: [2, 3], reps: [15, 20], restSec: [30, 45] },
			{ role: 'isolation', bodyPart: 'waist', sets: [2, 2], reps: [15, 20], restSec: [30, 45] }
		]
	}
];

/** Exact part-set matches preferred over broad (fullbody/upper). */
const SPECIFICITY: Record<string, number> = {
	arms: 10,
	shoulders: 10,
	chest: 10,
	back: 10,
	core: 10,
	legs: 8,
	push: 6,
	pull: 6,
	upper: 3,
	lower: 3,
	fullbody: 1
};

/**
 * Pick split template from body_part votes (majority / overlap).
 * Prefer specific templates (arms) over broad (fullbody).
 */
export function matchTemplate(
	parts: string[],
	hintParts: string[] = []
): SplitTemplate | null {
	const votes = new Map<string, number>();
	for (const p of [...parts, ...hintParts]) {
		votes.set(p, (votes.get(p) ?? 0) + 1);
	}
	if (!votes.size) return null;

	const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
	const dominant = ranked[0]![0];

	// Single-zone briefs → exact template
	const exact = SPLIT_TEMPLATES.find(
		(t) => t.triggerParts.length === 1 && t.triggerParts[0] === dominant
	);
	if (exact && (votes.get(dominant) ?? 0) >= Math.ceil(parts.length * 0.4 || 1)) {
		// If hints are multi-zone (push/pull), don't force arms/chest alone
		const uniqueHints = [...new Set(hintParts)];
		if (uniqueHints.length <= 1 || uniqueHints.every((h) => exact.triggerParts.includes(h))) {
			return exact;
		}
	}

	let best: SplitTemplate | null = null;
	let bestScore = -1;
	for (const t of SPLIT_TEMPLATES) {
		const overlap = t.triggerParts.filter((p) => votes.has(p)).length;
		if (!overlap) continue;
		const cover = overlap / t.triggerParts.length;
		const hintHit = hintParts.filter((p) => t.triggerParts.includes(p)).length;
		const score =
			cover * 10 +
			overlap +
			hintHit * 3 +
			(SPECIFICITY[t.id] ?? 0) * 0.1;
		if (score > bestScore) {
			bestScore = score;
			best = t;
		}
	}
	return best;
}

/** Format template for system prompt injection. */
export function formatTemplateForPrompt(t: SplitTemplate): string {
	const lines = t.slots.map((s) => {
		const sets = s.sets[0] === s.sets[1] ? `${s.sets[0]}` : `${s.sets[0]}-${s.sets[1]}`;
		const reps = s.reps[0] === s.reps[1] ? `${s.reps[0]}` : `${s.reps[0]}-${s.reps[1]}`;
		const rest =
			s.restSec[0] === s.restSec[1] ? `${s.restSec[0]}` : `${s.restSec[0]}-${s.restSec[1]}`;
		return `- ${s.role} @ ${s.bodyPart}: ${sets}×${reps}, rest ${rest} sec`;
	});
	return `РЕФЕРЕНС СПЛИТ «${t.labelRu}» / ${t.id} (следуй структуре слотов; упражнения СТРОГО из каталога под role+bodyPart):\n${lines.join('\n')}`;
}
