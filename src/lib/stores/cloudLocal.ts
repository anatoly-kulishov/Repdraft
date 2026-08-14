import { withTimeout } from '$lib/domain/withTimeout';
import type { CloudListRefreshResult } from '$lib/domain/cloudSync';
import { isCloudMode } from '$lib/storage/dataAccess';

export type { CloudListRefreshResult, CloudSyncState } from '$lib/domain/cloudSync';
export { isCloudListUncertain } from '$lib/domain/cloudSync';

const CLOUD_MS = 4000;

export async function refreshLocalCloudList<T>(opts: {
	localList: () => Promise<T[]>;
	cloudList: () => Promise<T[]>;
	merge: (local: T[], cloud: T[]) => T[];
	wantCloud?: boolean;
	label: string;
	onUpdate?: (result: CloudListRefreshResult<T>) => void;
}): Promise<CloudListRefreshResult<T>> {
	const emit = (result: CloudListRefreshResult<T>) => opts.onUpdate?.(result);

	emit({ items: [], state: 'loading' });

	const local = await opts.localList();
	const cloudActive = opts.wantCloud !== false && isCloudMode();

	if (!cloudActive) {
		const result: CloudListRefreshResult<T> = { items: local, state: 'synced' };
		emit(result);
		return result;
	}

	emit({ items: local, state: 'stale' });

	try {
		const cloud = await withTimeout(opts.cloudList(), CLOUD_MS);
		const result: CloudListRefreshResult<T> = {
			items: opts.merge(local, cloud),
			state: 'synced'
		};
		emit(result);
		return result;
	} catch (err) {
		console.warn(`${opts.label} cloud refresh failed`, err);
		const result: CloudListRefreshResult<T> = { items: local, state: 'error' };
		emit(result);
		return result;
	}
}

/** Local write always runs; returns whether cloud mirror succeeded (true if cloud off). */
export async function mirrorCloudWrite(opts: {
	localWrite: () => Promise<void>;
	cloudWrite?: () => Promise<void>;
	label: string;
}): Promise<boolean> {
	await opts.localWrite();
	if (!isCloudMode() || !opts.cloudWrite) return true;
	try {
		await withTimeout(opts.cloudWrite(), CLOUD_MS);
		return true;
	} catch (err) {
		console.warn(`${opts.label} cloud write failed`, err);
		return false;
	}
}
