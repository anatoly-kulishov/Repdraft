import type { Exercise } from '@repdraft/domain/types';
import { webOrigin } from './mediaUrl';

export type ExerciseDetailPayload = Pick<
	Exercise,
	| 'id'
	| 'name'
	| 'name_ru'
	| 'body_part'
	| 'equipment'
	| 'target'
	| 'image'
	| 'instructions'
	| 'instruction_steps'
>;

const cache = new Map<string, ExerciseDetailPayload>();

export async function fetchExerciseDetail(id: string): Promise<ExerciseDetailPayload | null> {
	const hit = cache.get(id);
	if (hit) return hit;
	try {
		const res = await fetch(`${webOrigin()}/api/catalog/exercise/${encodeURIComponent(id)}`);
		if (!res.ok) return null;
		const data = (await res.json()) as ExerciseDetailPayload;
		if (!data?.id) return null;
		cache.set(id, data);
		return data;
	} catch {
		return null;
	}
}

export function stepsForLocale(
	detail: ExerciseDetailPayload | null,
	locale: 'ru' | 'en'
): string[] {
	if (!detail) return [];
	const steps = detail.instruction_steps;
	const fromLocale = steps?.[locale];
	if (Array.isArray(fromLocale) && fromLocale.length) return fromLocale.filter(Boolean);
	const fromEn = steps?.en;
	if (Array.isArray(fromEn) && fromEn.length) return fromEn.filter(Boolean);
	const instr = detail.instructions?.[locale] || detail.instructions?.en;
	if (typeof instr === 'string' && instr.trim()) {
		return instr
			.split(/\n+/)
			.map((s) => s.trim())
			.filter(Boolean);
	}
	return [];
}
