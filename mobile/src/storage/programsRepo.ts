import {
	PROGRAM_RUNS_STORAGE_KEY,
	SAVED_PROGRAMS_STORAGE_KEY,
	parseProgramRuns,
	parseSavedPrograms,
	reconcileWithFinishedPlans,
	sessionSlotKey,
	type ProgramRun
} from '@repdraft/domain/programs';
import { kvGetJson, kvSetJson } from './kv';

async function readRuns(): Promise<Record<string, ProgramRun>> {
	return parseProgramRuns(await kvGetJson<unknown>(PROGRAM_RUNS_STORAGE_KEY, []));
}

async function writeRuns(runs: Record<string, ProgramRun>): Promise<void> {
	await kvSetJson(PROGRAM_RUNS_STORAGE_KEY, Object.values(runs));
}

async function readSaved(): Promise<string[]> {
	return parseSavedPrograms(await kvGetJson<unknown>(SAVED_PROGRAMS_STORAGE_KEY, []));
}

/**
 * Local-only, same model as web `src/lib/stores/programs.ts`: a run follows the
 * device, and a finished session with the slot's planId is the completion signal.
 */
export const programsRepo = {
	async runs(): Promise<Record<string, ProgramRun>> {
		return readRuns();
	},

	async run(slug: string): Promise<ProgramRun | null> {
		return (await readRuns())[slug] ?? null;
	},

	async saved(): Promise<string[]> {
		return readSaved();
	},

	async toggleSaved(slug: string): Promise<{ saved: boolean; slugs: string[] }> {
		const current = await readSaved();
		const saved = !current.includes(slug);
		const slugs = parseSavedPrograms(
			saved ? [slug, ...current] : current.filter((item) => item !== slug)
		);
		await kvSetJson(SAVED_PROGRAMS_STORAGE_KEY, slugs);
		return { saved, slugs };
	},

	async startSlot(slug: string, week: number, sessionId: string, planId: string): Promise<Record<string, ProgramRun>> {
		const runs = await readRuns();
		const prev = runs[slug];
		const at = new Date().toISOString();
		const next: Record<string, ProgramRun> = {
			...runs,
			[slug]: {
				slug,
				startedAt: prev?.startedAt || at,
				slots: {
					...(prev?.slots ?? {}),
					[sessionSlotKey(week, sessionId)]: {
						planId,
						startedAt: at,
						completedAt: null
					}
				}
			}
		};
		await writeRuns(next);
		return next;
	},

	/** Reconcile every run against finished plans; writes only when something changed. */
	async syncFinished(finishedPlanIds: ReadonlySet<string>): Promise<Record<string, ProgramRun>> {
		const runs = await readRuns();
		let changed = false;
		const next = { ...runs };
		for (const [slug, run] of Object.entries(runs)) {
			const result = reconcileWithFinishedPlans(run, finishedPlanIds);
			if (!result.changed) continue;
			next[slug] = result.run;
			changed = true;
		}
		if (changed) await writeRuns(next);
		return next;
	}
};
