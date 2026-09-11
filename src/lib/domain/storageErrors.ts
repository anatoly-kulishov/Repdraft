/** Browser storage quota / full disk signals (localStorage / IndexedDB). */
export function isQuotaExceededError(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const e = err as { name?: unknown; code?: unknown; message?: unknown };
	if (e.name === 'QuotaExceededError') return true;
	// Legacy WebKit / IE
	if (e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
	if (e.code === 22 || e.code === 1014) return true;
	const msg = typeof e.message === 'string' ? e.message : '';
	return /quotaexceeded|quota.?exceeded|not enough (disk )?space/i.test(msg);
}
