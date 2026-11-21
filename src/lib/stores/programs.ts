import { browser } from '$app/environment';
import {
	PROGRAM_RUNS_STORAGE_KEY,
	parseProgramRuns,
	reconcileWithFinishedPlans,
	sessionSlotKey,
	type ProgramRun
} from '$lib/domain/programs';
import { get, writable } from 'svelte/store';

function readRuns(): Record<string, ProgramRun> {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(PROGRAM_RUNS_STORAGE_KEY);
		if (!raw) return {};
		return parseProgramRuns(JSON.parse(raw) as unknown);
	} catch {
		return {};
	}
}

function writeRuns(runs: Record<string, ProgramRun>): void {
	if (!browser) return;
	try {
		localStorage.setItem(PROGRAM_RUNS_STORAGE_KEY, JSON.stringify(Object.values(runs)));
	} catch {
		/* quota / private mode: losing progress beats breaking the page */
	}
}

/**
 * Local-only, like the athlete profile: a program run follows the device.
 * The only cloud signal we use is a finished session whose planId matches the
 * slot's saved plan — that is what marks a session as done.
 */
function createProgramsStore() {
	/** Empty on purpose: SSR/prerender has no localStorage; `hydrate()` fills it after mount. */
	const store = writable<Record<string, ProgramRun>>({});

	return {
		subscribe: store.subscribe,
		hydrate() {
			if (!browser) return;
			store.set(readRuns());
		},
		/** Remember which saved plan belongs to a week/session slot. */
		startSlot(slug: string, week: number, sessionId: string, planId: string) {
			if (!browser || !slug || !planId) return;
			store.update((current) => {
				const prev = current[slug];
				const next: Record<string, ProgramRun> = {
					...current,
					[slug]: {
						slug,
						startedAt: prev?.startedAt || new Date().toISOString(),
						slots: {
							...(prev?.slots ?? {}),
							[sessionSlotKey(week, sessionId)]: {
								planId,
								startedAt: new Date().toISOString(),
								completedAt: null
							}
						}
					}
				};
				writeRuns(next);
				return next;
			});
		},
		/** Finished sessions are the source of truth for completion. */
		syncFinished(slug: string, finishedPlanIds: ReadonlySet<string>) {
			if (!browser) return;
			const prev = get(store)[slug];
			if (!prev) return;
			const { run, changed } = reconcileWithFinishedPlans(prev, finishedPlanIds);
			if (!changed) return;
			store.update((current) => {
				const next = { ...current, [slug]: run };
				writeRuns(next);
				return next;
			});
		}
	};
}

export const programs = createProgramsStore();
