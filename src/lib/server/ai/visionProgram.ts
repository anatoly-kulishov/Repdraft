/**
 * Extract a workout program from a photo via GigaChat Vision.
 * Returns raw names + sets/reps — catalog match happens on the client.
 */
import type { RecognizedProgram, RecognizedRow } from '$lib/domain/recognizeProgram';
import { clampPlanName } from '$lib/domain/inputLimits';
import { chatCompletion, deleteFile, uploadFile } from './chat';
import { resolveVisionAiConfig, type AiProvider } from './config';

export type VisionProgramOk = {
	ok: true;
	provider: AiProvider;
	model: string;
	program: RecognizedProgram;
};

export type VisionProgramErr = {
	ok: false;
	code: 'unavailable' | 'no_program' | 'upstream';
	error: string;
};

const SUBMIT_PROGRAM_FUNCTION = {
	name: 'submit_program',
	description: 'Распознанная силовая программа с листа: названия как написано, подходы и повторы',
	parameters: {
		type: 'object',
		properties: {
			name: { type: 'string', description: 'Краткое название программы или дня' },
			exercises: {
				type: 'array',
				minItems: 1,
				maxItems: 40,
				items: {
					type: 'object',
					properties: {
						name: { type: 'string', description: 'Название упражнения как на листе' },
						sets: { type: 'integer', minimum: 1, maximum: 99 },
						reps: { type: 'integer', minimum: 1, maximum: 999 },
						restSec: { type: 'integer', minimum: 0, maximum: 999 }
					},
					required: ['name', 'sets', 'reps']
				}
			}
		},
		required: ['name', 'exercises']
	}
};

const SYSTEM_PROMPT = `Ты — API распознавания программы тренировки с фото бумажного листа для приложения Repdraft.
Не чат-бот. Не придумывай упражнения, которых нет на фото.

Верни только то, что видно на листе:
- name: короткое название программы или дня (или "Программа", если заголовка нет)
- exercises: список { name, sets, reps, restSec? }
  - name — дословно как написано (язык листа)
  - sets / reps — числа с листа; если диапазон (8-12) — бери верхнее
  - restSec — только если указан отдых в секундах/минутах (минуты × 60)

Если на фото нет программы упражнений — верни пустой exercises.`;

function parseProgramPayload(raw: string): RecognizedProgram | null {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!data || typeof data !== 'object') return null;
	const obj = data as { name?: unknown; exercises?: unknown };
	const name = clampPlanName(typeof obj.name === 'string' ? obj.name : 'Program');
	if (!Array.isArray(obj.exercises)) return null;

	const rows: RecognizedRow[] = [];
	for (const item of obj.exercises) {
		if (!item || typeof item !== 'object') continue;
		const row = item as {
			name?: unknown;
			sets?: unknown;
			reps?: unknown;
			restSec?: unknown;
		};
		const exName = typeof row.name === 'string' ? row.name.trim() : '';
		if (!exName) continue;
		const sets = Number(row.sets);
		const reps = Number(row.reps);
		if (!Number.isFinite(sets) || !Number.isFinite(reps)) continue;
		const rest =
			row.restSec == null || row.restSec === ''
				? undefined
				: Number(row.restSec);
		rows.push({
			name: exName,
			sets,
			reps,
			...(Number.isFinite(rest) ? { restSec: rest as number } : {})
		});
	}
	if (rows.length === 0) return null;
	return { name, rows };
}

export async function recognizeProgramFromImage(
	bytes: Buffer,
	filename: string,
	contentType: string
): Promise<VisionProgramOk | VisionProgramErr> {
	const cfg = resolveVisionAiConfig();
	if (!cfg) {
		return { ok: false, code: 'unavailable', error: 'Vision AI not configured' };
	}

	let fileId: string | null = null;
	try {
		fileId = await uploadFile(cfg, bytes, filename, contentType);
		const result = await chatCompletion(cfg, {
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{
					role: 'user',
					content: 'Распознай программу на фото и вызови submit_program.',
					attachments: [fileId]
				}
			],
			functions: [SUBMIT_PROGRAM_FUNCTION],
			functionCall: { name: 'submit_program' },
			temperature: 0.1
		});
		const raw = result.functionArguments ?? result.content;
		if (!raw) {
			return { ok: false, code: 'upstream', error: 'Vision model returned empty response' };
		}
		const program = parseProgramPayload(raw);
		if (!program) {
			return { ok: false, code: 'no_program', error: 'No program found on image' };
		}
		return { ok: true, provider: cfg.provider, model: cfg.model, program };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, code: 'upstream', error: msg.slice(0, 300) };
	} finally {
		if (fileId) void deleteFile(cfg, fileId);
	}
}

