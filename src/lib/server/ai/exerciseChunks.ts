import { exerciseEmbedText } from './embedText';

export const EMBEDDING_DIMS = 768;
export const STEPS_CHUNK_MAX_CHARS = 1500;

export type ExerciseChunkKind = 'meta' | 'steps';

export type CatalogExerciseForChunk = {
	id: string;
	name: string;
	name_ru?: string;
	body_part: string;
	target: string;
	muscle_group: string;
	equipment: string;
	instructions?: { ru?: string; en?: string } | string | null;
	instruction_steps?: { ru?: string[]; en?: string[] } | string[] | null;
};

export type ExerciseChunk = {
	id: string;
	exerciseId: string;
	chunkKind: ExerciseChunkKind;
	content: string;
	bodyPart: string;
	target: string;
	equipment: string;
};

function asSteps(raw: unknown, lang: 'ru' | 'en'): string[] {
	if (!raw) return [];
	if (Array.isArray(raw)) {
		return raw.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
	}
	if (typeof raw === 'object') {
		const o = raw as { ru?: unknown; en?: unknown };
		const pick = lang === 'ru' ? o.ru : o.en;
		if (Array.isArray(pick)) {
			return pick.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
		}
	}
	return [];
}

function stepsText(ex: CatalogExerciseForChunk): string {
	const ruSteps = asSteps(ex.instruction_steps, 'ru');
	const enSteps = asSteps(ex.instruction_steps, 'en');
	const steps = ruSteps.length ? ruSteps : enSteps;
	if (steps.length) {
		return steps.join(' ').replace(/\s+/g, ' ').trim();
	}
	const instr = ex.instructions;
	if (typeof instr === 'string' && instr.trim()) return instr.trim();
	if (instr && typeof instr === 'object') {
		const ru = typeof instr.ru === 'string' ? instr.ru.trim() : '';
		const en = typeof instr.en === 'string' ? instr.en.trim() : '';
		return ru || en;
	}
	return '';
}

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 1).trimEnd()}...`;
}

/** Build 1–2 chunks per exercise for pgvector index. */
export function chunkExercise(ex: CatalogExerciseForChunk): ExerciseChunk[] {
	const bodyPart = ex.body_part ?? '';
	const target = ex.target ?? '';
	const equipment = ex.equipment ?? '';
	const out: ExerciseChunk[] = [
		{
			id: `${ex.id}:meta`,
			exerciseId: ex.id,
			chunkKind: 'meta',
			content: exerciseEmbedText(ex),
			bodyPart,
			target,
			equipment
		}
	];
	const steps = stepsText(ex);
	if (steps) {
		out.push({
			id: `${ex.id}:steps`,
			exerciseId: ex.id,
			chunkKind: 'steps',
			content: truncate(steps, STEPS_CHUNK_MAX_CHARS),
			bodyPart,
			target,
			equipment
		});
	}
	return out;
}

export function chunkCatalog(exercises: CatalogExerciseForChunk[]): ExerciseChunk[] {
	const out: ExerciseChunk[] = [];
	for (const ex of exercises) {
		if (!ex?.id) continue;
		out.push(...chunkExercise(ex));
	}
	return out;
}
