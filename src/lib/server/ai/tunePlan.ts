/**
 * Smart plan tune: the athlete says what hurts or what to emphasise today,
 * the model edits the existing plan (same exercise ids where they survive)
 * instead of generating a new one. Catalog match is deterministic on top.
 */
import { sanitizeAiBrief } from '$lib/domain/inputLimits';
import { normalizePlanTuneRows, type PlanTuneRow } from '$lib/domain/planTune';
import type { ExerciseIndexItem } from '$lib/domain/types';
import {
	catalogPromptLines,
	catalogWhitelist,
	exclusionsFromBrief,
	hintsFromBrief,
	loadExerciseIndex,
	popularity,
	slimCatalogForBrief
} from './catalog';
import { chatCompletion } from './chat';
import { resolveAiConfig, type AiProvider } from './config';

export type TunePlanInput = {
	/** Plan name as the athlete sees it (kept unless the model rewrites it). */
	name: string;
	exercises: readonly PlanTuneRow[];
};

export type TunePlanResult = {
	name: string;
	/** One short athlete-facing sentence: what changed and why. */
	summary: string;
	exercises: PlanTuneRow[];
};

export type TunePlanOk = {
	ok: true;
	provider: AiProvider;
	model: string;
	droppedUnknownIds: number;
	plan: TunePlanResult;
};

export type TunePlanErr = {
	ok: false;
	code: 'unavailable' | 'invalid_input' | 'invalid_plan' | 'upstream';
	error: string;
};

const MIN_EXERCISES = 2;
const MAX_EXERCISES = 8;
const MAX_SETS = 6;
const MIN_REPS = 4;
const MAX_REPS = 30;
const MIN_REST_SEC = 30;
const MAX_REST_SEC = 240;
const SUMMARY_MAX = 160;

/** Catalog body_part → a word hintsFromBrief/slimCatalogForBrief understands. */
const PART_WORD: Record<string, string> = {
	chest: 'грудь',
	back: 'спина',
	shoulders: 'плечи',
	'upper arms': 'руки',
	'upper legs': 'ноги',
	'lower legs': 'голень',
	waist: 'пресс',
	cardio: 'кардио',
	neck: 'шея'
};

const SYSTEM_TEMPLATE = `Ты — API точечной правки плана тренировки в приложении Repdraft. Не чат-бот.
Тебе дают готовый план и просьбу атлета (что болит, на чём сделать акцент, сколько есть времени).
Твоя задача — вернуть ИЗМЕНЁННЫЙ план целиком, а не собрать новый с нуля.

Ответ — один объект с тремя полями:
- name: название варианта, до 48 символов. Оставь исходное, если смысл плана не изменился.
- summary: одно короткое предложение по-русски, что поменял и почему, до ${SUMMARY_MAX} символов.
- exercises: массив объектов {exerciseId, sets, reps, restSec} в нужном порядке.

Главное правило: план ниже — уже готовая тренировка. Просьба его уточняет, а не заменяет.
В большинстве случаев правильных правок 1–2. Если сомневаешься — оставь как было.

Что делать по типам просьб:
1. Боль/травма (плечо, спина, колено, локоть, запястье): убери движения, которые грузят эту зону, или замени на безопасную альтернативу из каталога. При необходимости уменьши подходы на смежных движениях.
2. Если боль в зоне, которой в плане почти нет (например, болит колено, а план на грудь), — план не трогай, верни его как есть и напиши это в summary.
3. Акцент (грудь, спина, руки, ноги, ягодицы, плечи, пресс): добавь 1 упражнение на зону акцента и/или поставь её упражнения раньше. Место освобождай, убирая 1 упражнение, наименее связанное с акцентом, а не весь план.
4. «Полегче / мало сил / после болезни»: убери 1 упражнение и/или −1 подход у 2–3 упражнений. Отдых не сокращай. План не должен схлопнуться до 2 упражнений.
5. «Мало времени»: оставь 3–4 упражнения, сохрани главное движение дня.
6. Остальное (самочувствие, настроение, «хочу разнообразия»): 1 замена упражнения или небольшая правка подходов.

Технические требования:
7. exerciseId — СТРОГО из каталога ниже, без дублей. У оставшихся упражнений сохраняй их exerciseId.
8. Итоговый состав: ${MIN_EXERCISES}–${MAX_EXERCISES} упражнений. Порядок: база → вспомогательные → изоляция, если просьба не требует другого.
9. sets 1–${MAX_SETS}, reps ${MIN_REPS}–${MAX_REPS}, restSec ${MIN_REST_SEC}–${MAX_REST_SEC} (целые).
10. name — название плана, до 48 символов. Оставь исходное, если фокус плана тот же. Никогда не вставляй в name строки из плана, id, «×», «|» или «отдых».
11. summary — по-русски, до ${SUMMARY_MAX} символов, без markdown, эмодзи и кавычек-ёлочек внутри.
12. Если просьба не про тренировку или непонятна — верни план без изменений и summary «План оставил как есть».

{extra}

ТЕКУЩИЙ ПЛАН:
{plan}

КАТАЛОГ (id | название | зона | оборудование | target):
{catalog}`;

const SUBMIT_TUNE_FUNCTION = {
	name: 'submit_program_tune',
	description: 'Изменённый план тренировки: тот же план, подстроенный под просьбу атлета',
	parameters: {
		type: 'object',
		properties: {
			name: { type: 'string' },
			summary: { type: 'string' },
			exercises: {
				type: 'array',
				minItems: MIN_EXERCISES,
				maxItems: MAX_EXERCISES,
				items: {
					type: 'object',
					properties: {
						exerciseId: { type: 'string' },
						sets: { type: 'integer', minimum: 1, maximum: MAX_SETS },
						reps: { type: 'integer', minimum: MIN_REPS, maximum: MAX_REPS },
						restSec: { type: 'integer', minimum: MIN_REST_SEC, maximum: MAX_REST_SEC }
					},
					required: ['exerciseId', 'sets', 'reps', 'restSec']
				}
			}
		},
		required: ['name', 'summary', 'exercises']
	}
};

function stripJsonFences(text: string): string {
	let t = text.trim();
	if (t.startsWith('```')) {
		t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
	}
	return t.trim();
}

function planZoneWords(index: ExerciseIndexItem[], exercises: readonly PlanTuneRow[]): string {
	const byId = new Map(index.map((item) => [item.id, item]));
	const words = new Set<string>();
	for (const row of exercises) {
		const part = byId.get(row.exerciseId)?.body_part;
		if (!part) continue;
		const word = PART_WORD[part];
		if (word) words.add(word);
	}
	return [...words].join(' ');
}

function planPromptBlock(index: ExerciseIndexItem[], exercises: readonly PlanTuneRow[]): string {
	const byId = new Map(index.map((item) => [item.id, item]));
	return exercises
		.map((row, i) => {
			const item = byId.get(row.exerciseId);
			const title = item ? item.name_ru || item.name : row.exerciseId;
			const zone = item?.body_part ?? '?';
			return `${i + 1}. ${title} (id ${row.exerciseId}, зона ${zone}): ${row.sets} подхода по ${row.reps}, отдых ${row.restSec} сек`;
		})
		.join('\n');
}

/**
 * The catalog carries «(другой ракурс)» twins of the same movement. Left in the
 * prompt, the model happily puts both in one session (two close-grip benches).
 */
export function dedupeCatalogVariants(items: ExerciseIndexItem[]): ExerciseIndexItem[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key = variantKey(item);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function variantKey(item: ExerciseIndexItem): string {
	return (item.name_ru || item.name)
		.toLowerCase()
		.replace(/\([^)]*\)/g, ' ')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

/** Keep the plan's own exercises in the prompt catalog: they must stay selectable. */
function catalogForTune(
	index: ExerciseIndexItem[],
	plan: readonly PlanTuneRow[],
	brief: string,
	exclude: readonly string[]
): ExerciseIndexItem[] {
	const byId = new Map(index.map((item) => [item.id, item]));
	const candidateText = `${planZoneWords(index, plan)} ${brief}`.trim();
	const slim = slimCatalogForBrief(index, candidateText).filter(
		(item) => !exclude.includes(item.body_part)
	);
	// Plan rows go in first: their ids must win any variant-vs-plan collision.
	const ordered: ExerciseIndexItem[] = [];
	const seenIds = new Set<string>();
	for (const row of plan) {
		const item = byId.get(row.exerciseId);
		if (!item || seenIds.has(item.id)) continue;
		seenIds.add(item.id);
		ordered.push(item);
	}
	for (const item of slim) {
		if (seenIds.has(item.id)) continue;
		seenIds.add(item.id);
		ordered.push(item);
	}
	const list = dedupeCatalogVariants(ordered);
	if (list.length > 0) return list;
	return [...index].sort((a, b) => popularity(b) - popularity(a)).slice(0, 40);
}

/**
 * The model sometimes pastes a plan line into `name` («0025 | Жим лёжа | 4×6…»).
 * Anything that smells like a row rather than a title falls back to the plan name.
 */
export function sanitizeTuneName(raw: unknown, fallback: string): string {
	const name = String(raw ?? '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!name) return fallback;
	if (name.length > 48) return fallback;
	if (/[|×]/.test(name)) return fallback;
	// `\b` is ASCII-only in JS, so match the Russian words without it.
	if (/(отдых|подход|повтор)/i.test(name) && /\d/.test(name)) return fallback;
	return name;
}

/** Parse + clamp the model payload. Unknown ids are dropped, not invented. */
export function parseTunePayload(
	raw: unknown,
	allowed: ReadonlySet<string>,
	fallbackName: string
): { plan: TunePlanResult; droppedUnknownIds: number } {
	const obj = typeof raw === 'string' ? JSON.parse(stripJsonFences(raw)) : raw;
	if (!obj || typeof obj !== 'object') throw new Error('Tune payload is not an object');
	const rec = obj as Record<string, unknown>;

	const rows = normalizePlanTuneRows(rec.exercises);
	const known = rows.filter((row) => allowed.has(row.exerciseId));
	const exercises = known
		.slice(0, MAX_EXERCISES)
		.map((row) => ({
			exerciseId: row.exerciseId,
			sets: Math.min(MAX_SETS, Math.max(1, row.sets)),
			reps: Math.min(MAX_REPS, Math.max(MIN_REPS, row.reps)),
			restSec: Math.min(MAX_REST_SEC, Math.max(MIN_REST_SEC, row.restSec))
		}));
	if (exercises.length === 0) throw new Error('Tune plan has no known exercises');

	const name = sanitizeTuneName(rec.name, fallbackName);
	const summary = sanitizeAiBrief(String(rec.summary ?? ''), SUMMARY_MAX);
	return {
		plan: { name, summary, exercises },
		droppedUnknownIds: rows.length - known.length
	};
}

const MIN_TUNED_EXERCISES = 3;

/**
 * The model likes to answer «полегче» with a two-exercise session. Pad back from
 * the plan's own rows (never from an excluded zone) so the day keeps its shape.
 */
export function ensureTuneFloor(
	plan: TunePlanResult,
	base: readonly PlanTuneRow[],
	index: ExerciseIndexItem[],
	exclude: readonly string[]
): TunePlanResult {
	const target = Math.min(MIN_TUNED_EXERCISES, base.length);
	if (plan.exercises.length >= target) return plan;
	const byId = new Map(index.map((item) => [item.id, item]));
	const have = new Set(plan.exercises.map((row) => row.exerciseId));
	const exercises = [...plan.exercises];
	for (const row of base) {
		if (exercises.length >= target) break;
		if (have.has(row.exerciseId)) continue;
		const part = byId.get(row.exerciseId)?.body_part;
		if (part && exclude.includes(part)) continue;
		have.add(row.exerciseId);
		exercises.push({ ...row });
	}
	return exercises.length === plan.exercises.length ? plan : { ...plan, exercises };
}

export async function tuneWorkoutPlan(
	input: TunePlanInput,
	briefRaw: string
): Promise<TunePlanOk | TunePlanErr> {
	const brief = sanitizeAiBrief(briefRaw);
	if (!brief) return { ok: false, code: 'invalid_input', error: 'Empty brief' };
	if (input.exercises.length === 0) {
		return { ok: false, code: 'invalid_input', error: 'Empty plan' };
	}

	const cfg = resolveAiConfig();
	if (!cfg) return { ok: false, code: 'unavailable', error: 'AI provider not configured' };

	const index = loadExerciseIndex();
	const allowed = catalogWhitelist(index);
	const exclude = exclusionsFromBrief(brief);
	const { parts, equipment } = hintsFromBrief(brief);
	const catalogItems = catalogForTune(index, input.exercises, brief, exclude);

	const extra = [
		parts.length ? `ЗОНЫ ИЗ ПРОСЬБЫ (body_part): ${parts.join(', ')}.` : '',
		exclude.length
			? `ИСКЛЮЧЕНИЯ (body_part): ${exclude.join(', ')}. Не возвращай эти зоны в план.`
			: '',
		equipment.length ? `ОБОРУДОВАНИЕ из просьбы: ${equipment.join(', ')}.` : ''
	]
		.filter(Boolean)
		.join('\n');

	const system = SYSTEM_TEMPLATE.replace('{extra}', extra)
		.replace('{plan}', planPromptBlock(index, input.exercises))
		.replace('{catalog}', catalogPromptLines(catalogItems));
	const user = `План: ${input.name}\nПросьба атлета: ${brief}`;

	try {
		let raw: unknown;
		if (cfg.provider === 'gigachat') {
			const result = await chatCompletion(cfg, {
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: user }
				],
				functions: [SUBMIT_TUNE_FUNCTION],
				functionCall: { name: 'submit_program_tune' }
			});
			if (!result.functionArguments) {
				return { ok: false, code: 'upstream', error: 'GigaChat returned no function_call' };
			}
			raw = result.functionArguments;
		} else {
			let result;
			try {
				result = await chatCompletion(cfg, {
					messages: [
						{ role: 'system', content: system },
						{ role: 'user', content: user }
					],
					jsonObject: true
				});
			} catch {
				result = await chatCompletion(cfg, {
					messages: [
						{ role: 'system', content: system },
						{ role: 'user', content: user }
					]
				});
			}
			raw = result.content ?? '{}';
		}

		const parsed = parseTunePayload(raw, allowed, input.name);
		return {
			ok: true,
			provider: cfg.provider,
			model: cfg.model,
			droppedUnknownIds: parsed.droppedUnknownIds,
			plan: ensureTuneFloor(parsed.plan, input.exercises, index, exclude)
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, code: 'invalid_plan', error: message.slice(0, 200) };
	}
}
