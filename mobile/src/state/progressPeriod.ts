import {
	PROGRESS_PERIOD_STORAGE_KEY,
	parseProgressPeriod,
	type ProgressPeriod
} from '@repdraft/domain/progressOverview';
import { kvGet, kvSet } from '../storage/kv';

/** Shared key with web (`repdraft:progress-period`): the choice survives the session. */
export async function readProgressPeriod(): Promise<ProgressPeriod> {
	return parseProgressPeriod(await kvGet(PROGRESS_PERIOD_STORAGE_KEY), 30);
}

export async function writeProgressPeriod(period: ProgressPeriod): Promise<void> {
	await kvSet(PROGRESS_PERIOD_STORAGE_KEY, String(period));
}
