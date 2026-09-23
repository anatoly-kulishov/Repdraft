import { sanitizeAiBrief, AI_TUNE_NOTE_MAX } from '$lib/domain/inputLimits';
import type { ExerciseIndexItem } from '$lib/domain/types';
import { loadExerciseIndex } from './catalog';
import { chatCompletion } from './chat';
import { resolveAiConfig, type AiProvider } from './config';
import { cosine, loadEmbeddingIndex } from './embeddings';
import {
	matchTemplate,
	type SlotRole,
	type TemplateSlot
} from './splitTemplates';

export type TuneGoal = 'strength' | 'hypertrophy' | 'endurance' | 'general';

export type TunePrior = {
	sets: number;
	reps: number;
	restSec: number;
	why?: string;
};

export type TuneInput = {
	exerciseId: string;
	sets?: number;
	reps?: number;
	restSec?: number;
	goal?: TuneGoal;
	note?: string;
	prior?: TunePrior;
	lang?: 'ru' | 'en';
};

export type TunePrescription = {
	sets: number;
	reps: number;
	restSec: number;
	why: string;
};

export type TuneOk = {
	ok: true;
	provider: AiProvider;
	model: string;
	prescription: TunePrescription;
};

export type TuneErr = {
	ok: false;
	code: 'unavailable' | 'invalid_input' | 'invalid_prescription' | 'upstream';
	error: string;
};

const SETS_MIN = 2;
const SETS_MAX = 5;
const REPS_MIN = 5;
const REPS_MAX = 20;
const REST_MIN = 30;
const REST_MAX = 180;
const PEER_TOP_K = 5;

const GOALS: readonly TuneGoal[] = ['strength', 'hypertrophy', 'endurance', 'general'];

/** Hard preferred bands by goal. LLM may drift; we clamp into these after parse. */
type GoalBand = {
	sets: [number, number];
	reps: [number, number];
	restSec: [number, number];
};

const GOAL_BANDS: Record<TuneGoal, GoalBand> = {
	strength: { sets: [3, 5], reps: [5, 8], restSec: [120, 180] },
	hypertrophy: { sets: [3, 4], reps: [8, 12], restSec: [60, 120] },
	endurance: { sets: [2, 4], reps: [12, 20], restSec: [30, 75] },
	general: { sets: [3, 4], reps: [8, 15], restSec: [60, 120] }
};

export function goalBand(goal: TuneGoal): GoalBand {
	return GOAL_BANDS[isTuneGoal(goal) ? goal : 'general'];
}

/** Absolute clamp for sets/reps/rest (API prior + parse). */
export function clampTuneAbsolute(sets: number, reps: number, restSec: number): {
	sets: number;
	reps: number;
	restSec: number;
} {
	return {
		sets: clampInt(sets, SETS_MIN, SETS_MAX, 3),
		reps: clampInt(reps, REPS_MIN, REPS_MAX, 10),
		restSec: clampInt(restSec, REST_MIN, REST_MAX, 90)
	};
}

const SUBMIT_PRESCRIPTION_FUNCTION = {
	name: 'submit_prescription',
	description: 'Suggest sets, reps, and rest for one exercise',
	parameters: {
		type: 'object',
		properties: {
			sets: { type: 'integer', minimum: SETS_MIN, maximum: SETS_MAX },
			reps: { type: 'integer', minimum: REPS_MIN, maximum: REPS_MAX },
			restSec: { type: 'integer', minimum: REST_MIN, maximum: REST_MAX }
		},
		required: ['sets', 'reps', 'restSec']
	}
};

export type PrescriptionContext = {
	exercise: ExerciseIndexItem;
	slot: TemplateSlot | null;
	peers: ExerciseIndexItem[];
	mode: 'hybrid' | 'template';
};

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
	const v = typeof n === 'number' ? n : Number(n);
	if (!Number.isFinite(v)) return fallback;
	return Math.min(max, Math.max(min, Math.round(v)));
}

function stripJsonFences(text: string): string {
	let t = text.trim();
	if (t.startsWith('```')) {
		t = t.replace(/^```(?:json)?\s*/i, '');
		const close = t.indexOf('```');
		if (close >= 0) t = t.slice(0, close);
	}
	t = t.trim();
	// Drop trailing prose after a JSON object (common Ollama / chat appendix).
	if (t.startsWith('{')) {
		let depth = 0;
		for (let i = 0; i < t.length; i++) {
			const ch = t[i];
			if (ch === '{') depth++;
			else if (ch === '}') {
				depth--;
				if (depth === 0) return t.slice(0, i + 1);
			}
		}
	}
	return t;
}

export function isTuneGoal(v: unknown): v is TuneGoal {
	return typeof v === 'string' && (GOALS as readonly string[]).includes(v);
}

/** Heuristic role for picking a template slot. */
export function guessSlotRole(ex: ExerciseIndexItem): SlotRole {
	const blob = `${ex.name} ${ex.equipment} ${ex.target}`.toLowerCase();
	// pulldown = compound vertical pull; pushdown = isolation arm extension
	if (
		/curl|extension|fly|raise|kickback|shrug|calf|crunch|plank|pushdown/.test(blob)
	) {
		return 'isolation';
	}
	if (
		/squat|deadlift|bench|row|press|pull.?up|chin.?up|pulldown|clean|snatch|hip thrust/.test(
			blob
		) &&
		/barbell|body weight|cable|leverage machine|olympic/.test(blob)
	) {
		return 'heavy_compound';
	}
	if (/pulldown/.test(blob)) {
		return 'compound';
	}
	if (
		ex.body_part === 'upper arms' ||
		ex.body_part === 'lower legs' ||
		ex.body_part === 'waist'
	) {
		return 'isolation';
	}
	return 'compound';
}

export function pickSlotForExercise(ex: ExerciseIndexItem): TemplateSlot | null {
	const template = matchTemplate([ex.body_part], [ex.body_part]);
	if (!template) return null;
	const matching = template.slots.filter((s) => s.bodyPart === ex.body_part);
	const pool = matching.length ? matching : template.slots;
	const want = guessSlotRole(ex);
	const roleHit = pool.find((s) => s.role === want);
	if (roleHit) return roleHit;
	if (want === 'heavy_compound') {
		return pool.find((s) => s.role === 'compound') ?? pool[0] ?? null;
	}
	if (want === 'isolation') {
		return pool.find((s) => s.role === 'isolation') ?? pool[0] ?? null;
	}
	return pool[0] ?? null;
}

function formatSlot(slot: TemplateSlot): string {
	const sets = slot.sets[0] === slot.sets[1] ? `${slot.sets[0]}` : `${slot.sets[0]}-${slot.sets[1]}`;
	const reps = slot.reps[0] === slot.reps[1] ? `${slot.reps[0]}` : `${slot.reps[0]}-${slot.reps[1]}`;
	const rest =
		slot.restSec[0] === slot.restSec[1]
			? `${slot.restSec[0]}`
			: `${slot.restSec[0]}-${slot.restSec[1]}`;
	return `${slot.role} @ ${slot.bodyPart}: ${sets}×${reps}, rest ${rest}s`;
}

/**
 * Peers via precomputed embeddings (no network). Same body_part or target.
 * Empty when embeddings missing.
 */
export function findPeerExercises(
	exerciseId: string,
	index: ExerciseIndexItem[],
	topK = PEER_TOP_K
): ExerciseIndexItem[] {
	const embIndex = loadEmbeddingIndex();
	if (!embIndex?.items?.length) return [];
	const byId = new Map(index.map((e) => [e.id, e]));
	const exercise = byId.get(exerciseId);
	if (!exercise) return [];
	const self = embIndex.items.find((r) => r.id === exerciseId);
	if (!self?.vec?.length) return [];

	const embById = new Map(embIndex.items.map((r) => [r.id, r.vec]));
	const scored: Array<{ id: string; score: number }> = [];
	for (const [id, vec] of embById) {
		if (id === exerciseId) continue;
		const peer = byId.get(id);
		if (!peer) continue;
		if (peer.body_part !== exercise.body_part && peer.target !== exercise.target) continue;
		scored.push({ id, score: cosine(self.vec, vec) });
	}
	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, topK).map((s) => byId.get(s.id)!);
}

/** Structured + optional vector peers for the tune prompt. */
export function retrievePrescriptionContext(
	exerciseId: string,
	index: ExerciseIndexItem[] = loadExerciseIndex()
): PrescriptionContext | null {
	const exercise = index.find((e) => e.id === exerciseId);
	if (!exercise) return null;
	const slot = pickSlotForExercise(exercise);
	const peers = findPeerExercises(exerciseId, index);
	return {
		exercise,
		slot,
		peers,
		mode: peers.length ? 'hybrid' : 'template'
	};
}

function formatBand(b: GoalBand): string {
	const r = (lo: number, hi: number) => (lo === hi ? `${lo}` : `${lo}-${hi}`);
	return `sets ${r(b.sets[0], b.sets[1])}, reps ${r(b.reps[0], b.reps[1])}, rest ${r(b.restSec[0], b.restSec[1])}s`;
}

function clampToBand(n: number, band: [number, number]): number {
	return Math.min(band[1], Math.max(band[0], n));
}

/** Pull numbers into the goal band after absolute clamp. Refreshes why. */
export function alignPrescriptionToGoal(
	p: TunePrescription,
	goal: TuneGoal,
	lang: 'ru' | 'en' = 'ru'
): TunePrescription {
	const g = isTuneGoal(goal) ? goal : 'general';
	const b = goalBand(g);
	const aligned = {
		sets: clampToBand(p.sets, b.sets),
		reps: clampToBand(p.reps, b.reps),
		restSec: clampToBand(p.restSec, b.restSec),
		why: ''
	};
	return { ...aligned, why: whyForPrescription(aligned, g, lang) };
}

/** Deterministic caption: LLM why often invents ladders / cues that contradict the numbers. */
export function whyForPrescription(
	p: Pick<TunePrescription, 'sets' | 'reps' | 'restSec'>,
	goal: TuneGoal,
	lang: 'ru' | 'en' = 'ru'
): string {
	const g = isTuneGoal(goal) ? goal : 'general';
	const nums = `${p.sets}×${p.reps}, ${p.restSec}s`;
	if (lang === 'en') {
		switch (g) {
			case 'strength':
				return `${nums}: lower reps, longer rest for strength.`;
			case 'hypertrophy':
				return `${nums}: mid reps for muscle growth.`;
			case 'endurance':
				return `${nums}: higher reps, shorter rest for endurance.`;
			case 'general':
				return `${nums}: balanced mid-range load.`;
			default: {
				const _exhaustive: never = g;
				return _exhaustive;
			}
		}
	}
	switch (g) {
		case 'strength':
			return `${nums}: меньше повторов, длиннее отдых под силу.`;
		case 'hypertrophy':
			return `${nums}: средние повторы под рост мышц.`;
		case 'endurance':
			return `${nums}: больше повторов, короче отдых под выносливость.`;
		case 'general':
			return `${nums}: сбалансированная средняя нагрузка.`;
		default: {
			const _exhaustive: never = g;
			return _exhaustive;
		}
	}
}

/** Exported for selfchecks. */
export function parsePrescriptionPayload(
	raw: unknown,
	lang: 'ru' | 'en' = 'ru',
	goal: TuneGoal = 'general'
): TunePrescription {
	const g = isTuneGoal(goal) ? goal : 'general';
	let obj: unknown = raw;
	if (typeof raw === 'string') {
		obj = JSON.parse(stripJsonFences(raw));
	}
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
		throw new Error('Prescription payload is not an object');
	}
	const rec = obj as Record<string, unknown>;
	const absolute: TunePrescription = {
		...clampTuneAbsolute(Number(rec.sets), Number(rec.reps), Number(rec.restSec)),
		why: ''
	};
	return alignPrescriptionToGoal(absolute, g, lang);
}

function goalHint(goal: TuneGoal, lang: 'ru' | 'en'): string {
	const band = formatBand(goalBand(goal));
	if (lang === 'en') {
		switch (goal) {
			case 'strength':
				return `Goal: strength. Prefer lower reps, longer rest. Target band: ${band}.`;
			case 'hypertrophy':
				return `Goal: hypertrophy. Mid reps, moderate rest. Target band: ${band}.`;
			case 'endurance':
				return `Goal: endurance. Higher reps, shorter rest. Target band: ${band}.`;
			case 'general':
				return `Goal: general fitness. Balanced mid range. Target band: ${band}.`;
			default: {
				const _exhaustive: never = goal;
				return _exhaustive;
			}
		}
	}
	switch (goal) {
		case 'strength':
			return `Цель: сила. Меньше повторов, длиннее отдых. Диапазон: ${band}.`;
		case 'hypertrophy':
			return `Цель: гипертрофия. Средние повторы, умеренный отдых. Диапазон: ${band}.`;
		case 'endurance':
			return `Цель: выносливость. Больше повторов, короче отдых. Диапазон: ${band}.`;
		case 'general':
			return `Цель: общий тонус. Сбалансированный средний диапазон. Диапазон: ${band}.`;
		default: {
			const _exhaustive: never = goal;
			return _exhaustive;
		}
	}
}

function buildSystemPrompt(ctx: PrescriptionContext, lang: 'ru' | 'en'): string {
	const ex = ctx.exercise;
	const title = lang === 'ru' && ex.name_ru ? ex.name_ru : ex.name;
	const slotLine = ctx.slot
		? lang === 'en'
			? `Template slot: ${formatSlot(ctx.slot)}`
			: `Слот шаблона: ${formatSlot(ctx.slot)}`
		: lang === 'en'
			? 'No template slot; use role heuristics.'
			: 'Слота шаблона нет; опирайся на роль упражнения.';
	const peerLines =
		ctx.peers.length === 0
			? ''
			: (lang === 'en' ? 'Similar catalog peers:\n' : 'Похожие из каталога:\n') +
				ctx.peers
					.map((p) => {
						const n = lang === 'ru' && p.name_ru ? p.name_ru : p.name;
						return `- ${n} | ${p.body_part} | ${p.equipment} | ${p.target}`;
					})
					.join('\n');

	if (lang === 'en') {
		return `You are a Repdraft API that suggests sets × reps × rest for ONE gym exercise. Not a coach chat.
Return ONLY valid JSON (no markdown):
{"sets":3,"reps":10,"restSec":90}

Rules:
1. Integers only: sets ${SETS_MIN}-${SETS_MAX}, reps ${REPS_MIN}-${REPS_MAX}, restSec ${REST_MIN}-${REST_MAX}.
2. Goal band from the user message is PRIMARY. Numbers MUST stay inside that band.
3. Template slot is secondary context (role/equipment). Do not follow slot ranges if they conflict with the goal band.
4. Do not invent ladders, dropsets, tempos, or other schemes. Only sets, reps, restSec.
5. Do not invent other exercises or rewrite the whole plan.

Exercise: ${title} | zone ${ex.body_part} | equipment ${ex.equipment} | target ${ex.target}
${slotLine}
${peerLines}`.trim();
	}

	return `Ты — API подбора нагрузки для одного упражнения в Repdraft. Не чат-коуч.
Верни ТОЛЬКО валидный JSON без markdown:
{"sets":3,"reps":10,"restSec":90}

Правила:
1. Целые: sets ${SETS_MIN}-${SETS_MAX}, reps ${REPS_MIN}-${REPS_MAX}, restSec ${REST_MIN}-${REST_MAX}.
2. Диапазон цели из сообщения пользователя - ГЛАВНЫЙ. Цифры ОБЯЗАНЫ быть внутри него.
3. Слот шаблона - вторичный контекст (роль/оборудование). Не следуй слоту, если он противоречит диапазону цели.
4. Не выдумывай лесенки, дроп-сеты, темпо и другие схемы. Только sets, reps, restSec.
5. Не выдумывай другие упражнения и не переписывай весь план.

Упражнение: ${title} | зона ${ex.body_part} | оборудование ${ex.equipment} | target ${ex.target}
${slotLine}
${peerLines}`.trim();
}

function buildUserPrompt(input: TuneInput, lang: 'ru' | 'en'): string {
	const goal = input.goal && isTuneGoal(input.goal) ? input.goal : 'general';
	const parts: string[] = [goalHint(goal, lang)];
	if (
		typeof input.sets === 'number' ||
		typeof input.reps === 'number' ||
		typeof input.restSec === 'number'
	) {
		const cur = `${input.sets ?? '-'}×${input.reps ?? '-'}, rest ${input.restSec ?? '-'}s`;
		parts.push(lang === 'en' ? `Current draft: ${cur}` : `Сейчас в черновике: ${cur}`);
	}
	if (input.prior) {
		const p = `${input.prior.sets}×${input.prior.reps}, rest ${input.prior.restSec}s`;
		parts.push(
			lang === 'en'
				? `Previous suggestion: ${p}. Refine per the note.`
				: `Прошлое предложение: ${p}. Уточни по заметке.`
		);
	}
	const note = sanitizeAiBrief(input.note ?? '', AI_TUNE_NOTE_MAX);
	if (note) {
		parts.push(lang === 'en' ? `Athlete note: ${note}` : `Заметка: ${note}`);
	}
	return parts.join('\n');
}

export async function tunePrescription(input: TuneInput): Promise<TuneOk | TuneErr> {
	const exerciseId = String(input.exerciseId ?? '').trim();
	if (!exerciseId) {
		return { ok: false, code: 'invalid_input', error: 'Missing exerciseId' };
	}

	const ctx = retrievePrescriptionContext(exerciseId);
	if (!ctx) {
		return { ok: false, code: 'invalid_input', error: 'Unknown exerciseId' };
	}

	const cfg = resolveAiConfig();
	if (!cfg) {
		return { ok: false, code: 'unavailable', error: 'AI provider not configured' };
	}

	const lang = input.lang === 'en' ? 'en' : 'ru';
	const system = buildSystemPrompt(ctx, lang);
	const user = buildUserPrompt(input, lang);

	try {
		let raw: unknown;
		if (cfg.provider === 'gigachat') {
			const result = await chatCompletion(cfg, {
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: user }
				],
				functions: [SUBMIT_PRESCRIPTION_FUNCTION],
				functionCall: { name: 'submit_prescription' }
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

		const goal = input.goal && isTuneGoal(input.goal) ? input.goal : 'general';
		const prescription = parsePrescriptionPayload(raw, lang, goal);
		return {
			ok: true,
			provider: cfg.provider,
			model: cfg.model,
			prescription
		};
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Upstream error';
		if (msg.includes('Prescription') || msg.includes('JSON')) {
			return { ok: false, code: 'invalid_prescription', error: msg };
		}
		return { ok: false, code: 'upstream', error: msg };
	}
}
