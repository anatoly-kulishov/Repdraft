export type CloudSyncState = 'idle' | 'loading' | 'synced' | 'stale' | 'error';

export type CloudListRefreshResult<T> = {
	items: T[];
	state: CloudSyncState;
};

export function isCloudListUncertain(state: CloudSyncState): boolean {
	return state === 'stale' || state === 'error';
}
