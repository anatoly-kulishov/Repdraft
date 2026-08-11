import { withTimeout } from '$lib/domain/withTimeout';
import { isCloudMode } from '$lib/storage/dataAccess';

const CLOUD_MS = 4000;

export async function refreshLocalCloudList<T>(opts: {
	localList: () => Promise<T[]>;
	cloudList: () => Promise<T[]>;
	merge: (local: T[], cloud: T[]) => T[];
	wantCloud?: boolean;
	label: string;
	onLocal?: (local: T[]) => void;
}): Promise<T[]> {
	const local = await opts.localList();
	opts.onLocal?.(local);
	if (opts.wantCloud === false || !isCloudMode()) return local;
	try {
		const cloud = await withTimeout(opts.cloudList(), CLOUD_MS);
		return opts.merge(local, cloud);
	} catch (err) {
		console.warn(`${opts.label} cloud refresh failed`, err);
		return local;
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
