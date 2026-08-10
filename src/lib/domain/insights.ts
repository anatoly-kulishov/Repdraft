import type { WorkoutSession } from './types';
import { completedSetCount } from './session';

export type WeekBucket = {
	/** Monday date `YYYY-MM-DD` (local calendar). */
	weekKey: string;
	volumeKg: number;
	sessionCount: number;
};

export type WeekSummary = {
	weekKey: string;
	sessionCount: number;
	volumeKg: number;
};

export type SessionDerivedPr = {
	exerciseId: string;
	weightKg: number;
	reps: number;
	finishedAt: string;
};

/** Tonne-kilogram volume: only completed sets with known weight. */
export function sessionVolumeKg(session: WorkoutSession): number {
	let total = 0;
	for (const ex of session.exercises) {
		for (const set of ex.sets) {
			if (!set.completed || set.weightKg == null || set.reps == null) continue;
			if (set.weightKg < 0 || set.reps < 0) continue;
			total += set.weightKg * set.reps;
		}
	}
	return total;
}

/** Local-calendar Monday of the week containing `iso`, as `YYYY-MM-DD`. */
export function weekKey(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return 'invalid';
	const day = d.getDay(); // 0 Sun … 6 Sat
	const toMonday = day === 0 ? -6 : 1 - day;
	const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + toMonday);
	return formatYmd(monday);
}

function formatYmd(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function mondayDate(key: string): Date {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y!, m! - 1, d!);
}

function shiftWeekKey(key: string, deltaWeeks: number): string {
	const d = mondayDate(key);
	d.setDate(d.getDate() + deltaWeeks * 7);
	return formatYmd(d);
}

function finishedSessions(sessions: WorkoutSession[]): WorkoutSession[] {
	return sessions.filter((s) => Boolean(s.finishedAt));
}

export function currentWeekSummary(
	sessions: WorkoutSession[],
	nowIso: string = new Date().toISOString()
): WeekSummary {
	const key = weekKey(nowIso);
	let sessionCount = 0;
	let volumeKg = 0;
	for (const s of finishedSessions(sessions)) {
		if (weekKey(s.finishedAt!) !== key) continue;
		sessionCount += 1;
		volumeKg += sessionVolumeKg(s);
	}
	return { weekKey: key, sessionCount, volumeKg };
}

/** Oldest → newest, length `weeks`, includes empty weeks. */
export function weeklyVolumeSeries(
	sessions: WorkoutSession[],
	weeks = 8,
	nowIso: string = new Date().toISOString()
): WeekBucket[] {
	const n = Math.max(1, Math.min(52, Math.floor(weeks)));
	const endKey = weekKey(nowIso);
	const map = new Map<string, WeekBucket>();
	for (let i = n - 1; i >= 0; i--) {
		const key = shiftWeekKey(endKey, -i);
		map.set(key, { weekKey: key, volumeKg: 0, sessionCount: 0 });
	}
	for (const s of finishedSessions(sessions)) {
		const key = weekKey(s.finishedAt!);
		const bucket = map.get(key);
		if (!bucket) continue;
		bucket.sessionCount += 1;
		bucket.volumeKg += sessionVolumeKg(s);
	}
	return [...map.values()];
}

/**
 * Prefer volume bars; if every week has 0 kg but some weeks have sessions
 * (bodyweight / no weight logged), fall back to session-count bars.
 */
export type InsightsChartMode = 'volume' | 'frequency';

export function insightsChartMode(series: WeekBucket[]): InsightsChartMode {
	if (series.some((b) => b.volumeKg > 0)) return 'volume';
	if (series.some((b) => b.sessionCount > 0)) return 'frequency';
	return 'volume';
}

/**
 * Best completed set per exercise (higher weight; tie → more reps).
 * Sorted by weight desc, then most recent.
 */
export function sessionDerivedPrs(
	sessions: WorkoutSession[],
	limit = 5
): SessionDerivedPr[] {
	const best = new Map<string, SessionDerivedPr>();
	for (const s of finishedSessions(sessions)) {
		const finishedAt = s.finishedAt!;
		for (const ex of s.exercises) {
			for (const set of ex.sets) {
				if (!set.completed || set.weightKg == null || set.reps == null) continue;
				if (set.weightKg <= 0) continue;
				const prev = best.get(ex.exerciseId);
				const next: SessionDerivedPr = {
					exerciseId: ex.exerciseId,
					weightKg: set.weightKg,
					reps: set.reps,
					finishedAt
				};
				if (
					!prev ||
					next.weightKg > prev.weightKg ||
					(next.weightKg === prev.weightKg && next.reps > prev.reps) ||
					(next.weightKg === prev.weightKg &&
						next.reps === prev.reps &&
						next.finishedAt > prev.finishedAt)
				) {
					best.set(ex.exerciseId, next);
				}
			}
		}
	}
	return [...best.values()]
		.sort((a, b) => {
			if (b.weightKg !== a.weightKg) return b.weightKg - a.weightKg;
			return b.finishedAt.localeCompare(a.finishedAt);
		})
		.slice(0, Math.max(0, limit));
}

export function recentFinishedSessions(
	sessions: WorkoutSession[],
	limit = 8
): WorkoutSession[] {
	return finishedSessions(sessions)
		.slice()
		.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
		.slice(0, Math.max(0, limit));
}

export function historyTotalCompletedSets(sessions: WorkoutSession[]): number {
	return finishedSessions(sessions).reduce((n, s) => n + completedSetCount(s), 0);
}

export function historyTotalVolumeKg(sessions: WorkoutSession[]): number {
	return finishedSessions(sessions).reduce((n, s) => n + sessionVolumeKg(s), 0);
}

/** Consecutive local calendar days with a finished session, ending today or yesterday. */
export function trainingStreakDays(
	sessions: WorkoutSession[],
	nowIso: string = new Date().toISOString()
): number {
	const days = new Set<string>();
	for (const s of finishedSessions(sessions)) {
		if (s.finishedAt) days.add(formatYmd(new Date(s.finishedAt)));
	}
	if (days.size === 0) return 0;
	const now = new Date(nowIso);
	let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const key = (d: Date) => formatYmd(d);
	if (!days.has(key(cursor))) {
		cursor.setDate(cursor.getDate() - 1);
		if (!days.has(key(cursor))) return 0;
	}
	let streak = 0;
	while (days.has(key(cursor))) {
		streak += 1;
		cursor.setDate(cursor.getDate() - 1);
	}
	return streak;
}

/** Throws if core aggregations regress. */
export function runInsightsSelfCheck(): void {
	const base: WorkoutSession = {
		id: 's1',
		planId: 'p1',
		planName: 'Test',
		startedAt: '2026-08-03T10:00:00.000Z',
		finishedAt: '2026-08-03T11:00:00.000Z',
		exercises: [
			{
				exerciseId: 'ex-a',
				targetSets: 2,
				targetReps: 5,
				restSec: 90,
				sets: [
					{ weightKg: 100, reps: 5, completed: true },
					{ weightKg: 100, reps: 5, completed: true },
					{ weightKg: null, reps: 10, completed: true },
					{ weightKg: 80, reps: 8, completed: false }
				]
			}
		]
	};

	const vol = sessionVolumeKg(base);
	if (vol !== 1000) throw new Error(`sessionVolumeKg expected 1000, got ${vol}`);

	const now = '2026-08-05T12:00:00.000Z';
	const series = weeklyVolumeSeries([base], 2, now);
	if (series.length !== 2) throw new Error(`weeklyVolumeSeries length ${series.length}`);
	const withVol = series.find((b) => b.volumeKg > 0);
	if (!withVol || withVol.sessionCount !== 1) {
		throw new Error('weeklyVolumeSeries missing session week');
	}

	const prs = sessionDerivedPrs([base], 5);
	if (prs.length !== 1 || prs[0]!.weightKg !== 100 || prs[0]!.reps !== 5) {
		throw new Error(`sessionDerivedPrs unexpected ${JSON.stringify(prs)}`);
	}

	const empty = currentWeekSummary([], now);
	if (empty.sessionCount !== 0 || empty.volumeKg !== 0) {
		throw new Error('currentWeekSummary empty failed');
	}

	if (insightsChartMode(series) !== 'volume') {
		throw new Error('insightsChartMode should prefer volume when kg > 0');
	}
	const bwOnly: WorkoutSession = {
		...base,
		id: 's-bw',
		finishedAt: '2026-08-04T11:00:00.000Z',
		exercises: [
			{
				exerciseId: 'ex-bw',
				targetSets: 1,
				targetReps: 10,
				restSec: 60,
				sets: [{ weightKg: null, reps: 10, completed: true }]
			}
		]
	};
	const freqSeries = weeklyVolumeSeries([bwOnly], 2, now);
	if (insightsChartMode(freqSeries) !== 'frequency') {
		throw new Error('insightsChartMode should fall back to frequency when volume is all zero');
	}
	if (insightsChartMode([]) !== 'volume') {
		throw new Error('insightsChartMode empty series defaults to volume');
	}
}
