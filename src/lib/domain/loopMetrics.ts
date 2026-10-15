/**
 * Phase A: local sacred-loop metrics from session history.
 * Pure - no DOM, no analytics vendors. Operator / tester snapshot only.
 */
import type { WorkoutSession } from './types';

const MS_DAY = 24 * 60 * 60 * 1000;

export type LoopMetricsSnapshot = {
	sessionStarted: number;
	sessionFinished: number;
	/** finished / started; null if no starts. */
	completionRate: number | null;
	firstStartedAt: string | null;
	firstFinishedAt: string | null;
	/**
	 * First finish within 7 days of first start.
	 * null if there is no finished session yet.
	 */
	activatedWithin7d: boolean | null;
	/**
	 * Among activated users (first finish exists): has a finish whose day
	 * offset from first finish is in [22, 28].
	 * null if not activated or observation window not yet open.
	 */
	week4Retained: boolean | null;
	/** Days since first finish; null if never finished. */
	daysSinceFirstFinish: number | null;
};

function parseTime(iso: string | null | undefined): number | null {
	if (!iso) return null;
	const t = Date.parse(iso);
	return Number.isFinite(t) ? t : null;
}

function dayOffset(fromMs: number, toMs: number): number {
	return Math.floor((toMs - fromMs) / MS_DAY);
}

/** Compute loop metrics for one device's session list. */
export function computeLoopMetrics(
	sessions: readonly WorkoutSession[],
	nowIso: string
): LoopMetricsSnapshot {
	const nowMs = parseTime(nowIso) ?? Date.now();
	const started = sessions.filter((s) => parseTime(s.startedAt) != null);
	const finished = sessions.filter((s) => parseTime(s.finishedAt) != null);

	const startTimes = started
		.map((s) => parseTime(s.startedAt)!)
		.sort((a, b) => a - b);
	const finishTimes = finished
		.map((s) => parseTime(s.finishedAt)!)
		.sort((a, b) => a - b);

	const firstStartedAt = startTimes.length ? new Date(startTimes[0]!).toISOString() : null;
	const firstFinishedAt = finishTimes.length ? new Date(finishTimes[0]!).toISOString() : null;

	const sessionStarted = started.length;
	const sessionFinished = finished.length;
	const completionRate =
		sessionStarted === 0 ? null : sessionFinished / sessionStarted;

	let activatedWithin7d: boolean | null = null;
	if (firstFinishedAt && firstStartedAt) {
		const startMs = startTimes[0]!;
		const finishMs = finishTimes[0]!;
		activatedWithin7d = dayOffset(startMs, finishMs) <= 7;
	} else if (firstFinishedAt) {
		activatedWithin7d = true;
	} else {
		activatedWithin7d = null;
	}

	let week4Retained: boolean | null = null;
	let daysSinceFirstFinish: number | null = null;
	if (finishTimes.length > 0) {
		const firstFinishMs = finishTimes[0]!;
		daysSinceFirstFinish = dayOffset(firstFinishMs, nowMs);
		if (daysSinceFirstFinish < 22) {
			week4Retained = null;
		} else {
			week4Retained = finishTimes.some((t) => {
				const d = dayOffset(firstFinishMs, t);
				return d >= 22 && d <= 28;
			});
		}
	}

	return {
		sessionStarted,
		sessionFinished,
		completionRate,
		firstStartedAt,
		firstFinishedAt,
		activatedWithin7d,
		week4Retained,
		daysSinceFirstFinish
	};
}

/** Percent label for UI (null → hyphen). */
export function formatRatePercent(rate: number | null): string {
	if (rate == null || !Number.isFinite(rate)) return '-';
	return `${Math.round(rate * 100)}%`;
}
