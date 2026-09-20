import { clampPlanName } from '$lib/domain/inputLimits';
import type { WorkoutExercise } from '$lib/domain/types';
import {
	catalogPromptLines,
	catalogWhitelist,
	hintsFromBrief,
	loadExerciseIndex,
	slimCatalogForBrief
} from './catalog';
import { chatCompletion } from './chat';
import { resolveAiConfig, type AiProvider } from './config';

export type AiPlanExercise = {
	exerciseId: string;
	sets: number;
	reps: number;
	restSec: number;
};

export type AiPlan = {
	name: string;
	exercises: AiPlanExercise[];
};

export type GeneratePlanOk = {
	ok: true;
	provider: AiProvider;
	model: string;
	plan: AiPlan;
	droppedUnknownIds: number;
};

export type GeneratePlanErr = {
	ok: false;
	code: 'unavailable' | 'invalid_brief' | 'invalid_plan' | 'upstream';
	error: string;
};

const MIN_EXERCISES = 5;
const MAX_EXERCISES = 8;

const SYSTEM_TEMPLATE = `Ты — API генерации плана тренировки для приложения Repdraft. Не чат-бот.
Собери силовой план для зала: безопасный, логичный по нагрузке, без воды.

Верни ТОЛЬКО валидный JSON без markdown:
{
  "name": "краткое название плана",
  "exercises": [
    {"exerciseId": "<id из каталога>", "sets": 4, "reps": 6, "restSec": 150},
    {"exerciseId": "<id из каталога>", "sets": 3, "reps": 10, "restSec": 90},
    {"exerciseId": "<id из каталога>", "sets": 3, "reps": 12, "restSec": 60}
  ]
}

Правила состава:
1. exerciseId — СТРОГО из списка каталога ниже. Не выдумывай id.
2. ОБЯЗАТЕЛЬНО ${MIN_EXERCISES}–${MAX_EXERCISES} упражнений. Норма для «полноценной» сессии — 6.
3. Без дублей id. Порядок: тяжёлые/базовые (multi-joint) → вспомогательные → изоляция.
4. Учитывай зоны и оборудование из brief (штанга/гантели/кабель/тренажёры и т.д.).
5. Если в brief есть минуты — уложись в бюджет: ~45 мин ≈ 5–6 упр., ~60 мин ≈ 6–7, ~75+ ≈ 7–8.
6. Если brief мусорный — простой full-body из каталога (${MIN_EXERCISES}+ упр.), всё равно с разной нагрузкой.

Программирование sets / reps / restSec (обязательно варьируй, не копируй один шаблон на все):
7. База (жим/тяга/присед/гребля и аналоги): sets 3–5, reps 5–8, restSec 120–180.
8. Вспомогательные compound: sets 3–4, reps 8–12, restSec 90–120.
9. Изоляция (бицепс/трицепс/дельты/икры и т.п.): sets 2–3, reps 10–15, restSec 45–75.
10. Кор / лёгкая техника: sets 2–3, reps 12–20, restSec 30–60.
11. В одном плане минимум 3 разных комбинации (sets,reps,restSec). Не ставь всем одинаковые 3×10×90.
12. Диапазоны чисел: sets 2–5, reps 5–20, restSec 30–180 (целые).
13. Не дублируй почти одинаковые движения (две тяги в наклоне, три сгибания на бицепс со штангой). Один паттерн — одно упражнение; смена плоскости/оборудования только если даёт явный смысл.
14. Сплит из двух зон (например спина+бицепс): 2–3 тяги/базы + 1–2 изоляции на вторую зону. Изоляция одной мышцы — не больше ~40% списка.
15. Если brief задаёт зону (руки/грудь/ноги/…) — бери ТОЛЬКО упражнения этой зоны (и явно названных соседних). Не подмешивай присед/ягодицы в план на руки и т.п.

КАТАЛОГ (id | название | зона | оборудование | target):
{catalog}`;

const SUBMIT_PLAN_FUNCTION = {
	name: 'submit_plan',
	description: `Силовой план ${MIN_EXERCISES}–${MAX_EXERCISES} упр. с разной нагрузкой (база тяжелее, изоляция легче)`,
	parameters: {
		type: 'object',
		properties: {
			name: { type: 'string' },
			exercises: {
				type: 'array',
				minItems: MIN_EXERCISES,
				maxItems: MAX_EXERCISES,
				items: {
					type: 'object',
					properties: {
						exerciseId: { type: 'string' },
						sets: { type: 'integer', minimum: 2, maximum: 5 },
						reps: { type: 'integer', minimum: 5, maximum: 20 },
						restSec: { type: 'integer', minimum: 30, maximum: 180 }
					},
					required: ['exerciseId', 'sets', 'reps', 'restSec']
				}
			}
		},
		required: ['name', 'exercises']
	}
};

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
	const v = typeof n === 'number' ? n : Number(n);
	if (!Number.isFinite(v)) return fallback;
	return Math.min(max, Math.max(min, Math.round(v)));
}

function stripJsonFences(text: string): string {
	let t = text.trim();
	if (t.startsWith('```')) {
		t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
	}
	return t.trim();
}

/** Exported for domain selfchecks. */
export function parsePlanPayload(raw: unknown): AiPlan {
	let obj: unknown = raw;
	if (typeof raw === 'string') {
		obj = JSON.parse(stripJsonFences(raw));
	}
	if (!obj || typeof obj !== 'object') {
		throw new Error('Plan payload is not an object');
	}
	const rec = obj as Record<string, unknown>;
	const name = clampPlanName(String(rec.name ?? '').trim());
	if (!name) throw new Error('Plan name is empty');

	const list = Array.isArray(rec.exercises) ? rec.exercises : [];
	if (!list.length) throw new Error('Plan has no exercises');

	const seen = new Set<string>();
	const exercises: AiPlanExercise[] = [];
	for (const item of list.slice(0, MAX_EXERCISES)) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const exerciseId = String(row.exerciseId ?? '').trim();
		if (!exerciseId || seen.has(exerciseId)) continue;
		seen.add(exerciseId);
		exercises.push({
			exerciseId,
			sets: clampInt(row.sets, 2, 5, 3),
			reps: clampInt(row.reps, 5, 20, 10),
			restSec: clampInt(row.restSec, 30, 180, 90)
		});
	}
	if (!exercises.length) throw new Error('No valid exercises after parse');
	return { name, exercises };
}

/** Exported for domain selfchecks. */
export function filterKnownIds(plan: AiPlan, allowed: Set<string>): AiPlan {
	const kept = plan.exercises.filter((e) => allowed.has(e.exerciseId));
	if (!kept.length) {
		throw new Error('После whitelist не осталось упражнений — модель вернула неизвестные id');
	}
	return { name: plan.name, exercises: kept };
}

/** Keep only exercises whose body_part is in brief hints (when hints exist). */
export function filterToBodyHints(
	plan: AiPlan,
	index: ReturnType<typeof loadExerciseIndex>,
	parts: string[]
): AiPlan {
	if (!parts.length) return plan;
	const ok = new Set(
		index.filter((ex) => parts.includes(ex.body_part)).map((ex) => ex.id)
	);
	const kept = plan.exercises.filter((e) => ok.has(e.exerciseId));
	if (!kept.length) {
		throw new Error('После фильтра зоны не осталось упражнений');
	}
	return { name: plan.name, exercises: kept };
}

/** If the model under-delivers, pad from slim then optional fallback pool (whitelist-only). */
export function padToMinExercises(
	plan: AiPlan,
	slim: ReturnType<typeof slimCatalogForBrief>,
	allowed: Set<string>,
	fallback: ReturnType<typeof slimCatalogForBrief> = []
): AiPlan {
	const have = new Set(plan.exercises.map((e) => e.exerciseId));
	const exercises = [...plan.exercises];
	for (const ex of [...slim, ...fallback]) {
		if (exercises.length >= MIN_EXERCISES) break;
		if (!allowed.has(ex.id) || have.has(ex.id)) continue;
		have.add(ex.id);
		exercises.push({ exerciseId: ex.id, sets: 3, reps: 10, restSec: 90 });
	}
	const need = Math.min(MIN_EXERCISES, allowed.size);
	if (exercises.length < need) {
		throw new Error(
			`План слишком короткий после добора: ${exercises.length} (нужно ≥${need})`
		);
	}
	return { name: plan.name, exercises: exercises.slice(0, MAX_EXERCISES) };
}

export function toWorkoutExercises(plan: AiPlan): WorkoutExercise[] {
	return plan.exercises.map((e) => ({
		exerciseId: e.exerciseId,
		sets: e.sets,
		reps: e.reps,
		restSec: e.restSec
	}));
}

export async function generateWorkoutPlan(briefRaw: string): Promise<GeneratePlanOk | GeneratePlanErr> {
	const brief = briefRaw
		.replace(/[\u200B-\u200D\uFEFF]/g, '')
		.trim()
		.replace(/\s+/g, ' ')
		.slice(0, 500);
	if (!brief) {
		return { ok: false, code: 'invalid_brief', error: 'Empty brief' };
	}

	const cfg = resolveAiConfig();
	if (!cfg) {
		return { ok: false, code: 'unavailable', error: 'AI provider not configured' };
	}

	const index = loadExerciseIndex();
	const allowed = catalogWhitelist(index);
	const slim = slimCatalogForBrief(index, brief);
	const { parts } = hintsFromBrief(brief);
	const system = SYSTEM_TEMPLATE.replace('{catalog}', catalogPromptLines(slim));

	try {
		let raw: unknown;
		if (cfg.provider === 'gigachat') {
			const result = await chatCompletion(cfg, {
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: brief }
				],
				functions: [SUBMIT_PLAN_FUNCTION],
				functionCall: { name: 'submit_plan' }
			});
			if (!result.functionArguments) {
				return {
					ok: false,
					code: 'upstream',
					error: 'GigaChat returned no function_call'
				};
			}
			raw = result.functionArguments;
		} else {
			let result;
			try {
				result = await chatCompletion(cfg, {
					messages: [
						{ role: 'system', content: system },
						{ role: 'user', content: brief }
					],
					jsonObject: true
				});
			} catch {
				result = await chatCompletion(cfg, {
					messages: [
						{ role: 'system', content: system },
						{ role: 'user', content: brief }
					]
				});
			}
			raw = result.content ?? '{}';
		}

		let plan = parsePlanPayload(raw);
		const before = plan.exercises.length;
		plan = filterKnownIds(plan, allowed);
		plan = filterToBodyHints(plan, index, parts);
		const afterFilter = plan.exercises.length;
		// Zone briefs: pad only from slim. Untargeted briefs may fall back to full index.
		plan = padToMinExercises(plan, slim, allowed, parts.length ? [] : index);
		return {
			ok: true,
			provider: cfg.provider,
			model: cfg.model,
			plan,
			droppedUnknownIds: before - afterFilter
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (message.includes('whitelist') || message.includes('Plan ') || message.includes('parse')) {
			return { ok: false, code: 'invalid_plan', error: message };
		}
		return { ok: false, code: 'upstream', error: message };
	}
}
