import {
	CYCLE_STORAGE_KEY,
	normalizeCycle,
	parseCycleStorage,
	serializeCycleStorage,
	type Mesocycle
} from '@repdraft/domain/cycle';
import { kvGet, kvRemove, kvSet } from '../storage/kv';

/** Local-only cycle, same key as web (follows the device, like the athlete profile). */
export async function readCycle(): Promise<Mesocycle | null> {
	try {
		return parseCycleStorage(await kvGet(CYCLE_STORAGE_KEY));
	} catch {
		return null;
	}
}

export async function writeCycle(next: Mesocycle): Promise<Mesocycle> {
	const normalized = normalizeCycle(next) ?? next;
	await kvSet(CYCLE_STORAGE_KEY, serializeCycleStorage(normalized));
	return normalized;
}

export async function clearCycle(): Promise<void> {
	await kvRemove(CYCLE_STORAGE_KEY);
}
