import {
	parseTesterModeEnabled,
	TESTER_MODE_STORAGE_KEY
} from '@repdraft/domain/prefs';
import { kvGet, kvSet } from '../storage/kv';

export async function isTesterModeEnabled(): Promise<boolean> {
	return parseTesterModeEnabled(await kvGet(TESTER_MODE_STORAGE_KEY));
}

export async function setTesterModeEnabled(on: boolean): Promise<void> {
	await kvSet(TESTER_MODE_STORAGE_KEY, on ? '1' : '0');
}
