import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
	computeProgressOverview,
	type ProgressPeriod
} from '@repdraft/domain/progressOverview';
import { formatKgInt } from '@repdraft/domain/format';
import type { WorkoutSession } from '@repdraft/domain/types';
import { getIndexItem, refreshCustomsCache } from '../catalog/loadIndex';
import { useLocale } from '../state/locale';
import { sessionsRepo } from '../storage/sessionsRepo';

/**
 * Data + formatting for the Progress screen. UI stays in the screen and
 * presentational panels; this hook owns period, sessions and derived labels.
 */
export function useProgressScreen() {
	const { locale, tt } = useLocale();
	const [sessions, setSessions] = useState<WorkoutSession[]>([]);
	const [period, setPeriod] = useState<ProgressPeriod>(30);

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				await refreshCustomsCache();
				setSessions(await sessionsRepo.list());
			})();
		}, [])
	);

	const overview = useMemo(
		() =>
			computeProgressOverview(
				sessions,
				new Date(),
				(id) => getIndexItem(id)?.body_part ?? null,
				{ period }
			),
		[sessions, period]
	);

	const maxWeekVol = Math.max(1, ...overview.weeks.map((w) => w.volumeKg));
	// Small samples make a "lagging" flag noisy: require enough groups and workouts.
	const laggingPart =
		overview.setShares.length >= 3 && overview.cards.workouts >= 4
			? overview.laggingBodyPart
			: null;

	const formatWeight = useCallback((kg: number) => {
		return Number.isInteger(kg) ? String(kg) : String(Math.round(kg * 10) / 10);
	}, []);

	function periodNoun(): string {
		if (period === 7) return tt('progress.periodPastWeek');
		if (period === 90 || period === 30) return tt('progress.periodPastDays', { n: period });
		return '';
	}

	function deltaSign(delta: number): string {
		return delta > 0 ? '+' : delta < 0 ? '−' : '';
	}

	function workoutsDeltaText(): string | null {
		const delta = overview.cards.workoutsDelta;
		if (delta == null) return null;
		if (delta === 0) return tt('progress.deltaNone');
		return tt('progress.deltaWorkouts', {
			sign: deltaSign(delta),
			n: Math.abs(delta),
			p: periodNoun()
		});
	}

	function volumeDeltaText(): string | null {
		const delta = overview.cards.volumeKgDelta;
		if (delta == null) return null;
		if (delta === 0) return tt('progress.deltaNone');
		return tt('progress.deltaVolume', {
			sign: deltaSign(delta),
			n: formatKgInt(Math.abs(delta))
		});
	}

	/** Human range for a Monday-based weekKey: "21–27 сент". */
	function weekRange(weekKey: string): string {
		const monday = new Date(`${weekKey}T00:00:00`);
		const sunday = new Date(monday);
		sunday.setDate(monday.getDate() + 6);
		const tag = locale === 'ru' ? 'ru-RU' : 'en-US';
		const month = new Intl.DateTimeFormat(tag, { month: 'short' }).format(sunday);
		return `${monday.getDate()}–${sunday.getDate()} ${month.replace(/\.$/, '')}`;
	}

	function trendSigned(deltaKg: number): string {
		return `${deltaKg > 0 ? '+' : ''}${formatWeight(deltaKg)} ${tt('pr.kg')}`;
	}

	return {
		period,
		setPeriod,
		overview,
		maxWeekVol,
		laggingPart,
		formatWeight,
		workoutsDeltaText,
		volumeDeltaText,
		weekRange,
		trendSigned
	};
}

export type ProgressScreenState = ReturnType<typeof useProgressScreen>;
