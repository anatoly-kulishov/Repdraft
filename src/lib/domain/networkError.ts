/**
 * True when the failure is "no usable network" rather than an app/server error.
 * Outbox flush should stay quiet (pending) for these; do not show "Sync failed".
 */
export function isNetworkFailure(err: unknown): boolean {
	if (err == null) return false;
	if (typeof err === 'string') return isNetworkMessage(err);

	if (typeof err === 'object') {
		const record = err as { name?: unknown; message?: unknown; code?: unknown };
		const name = typeof record.name === 'string' ? record.name : '';
		const message = typeof record.message === 'string' ? record.message : '';
		const code = typeof record.code === 'string' ? record.code : '';

		/* withTimeout rejects with Error('errors.timeout'). */
		if (message === 'errors.timeout' || code === 'errors.timeout') return true;
		if (name === 'TimeoutError' || name === 'AbortError') return true;
		if (name === 'TypeError' && isNetworkMessage(message)) return true;
		if (isNetworkMessage(message)) return true;
		if (code === 'NETWORK_ERROR' || code === 'ENOTFOUND' || code === 'ECONNREFUSED') return true;
	}

	return false;
}

function isNetworkMessage(message: string): boolean {
	const m = message.toLowerCase();
	return (
		m.includes('failed to fetch') ||
		m.includes('load failed') ||
		m.includes('networkerror') ||
		m.includes('network request failed') ||
		m.includes('network error') ||
		m.includes('fetch failed') ||
		m.includes('the internet connection appears to be offline') ||
		m.includes('offline')
	);
}

export function runNetworkErrorSelfCheck(): void {
	if (!isNetworkFailure(new TypeError('Failed to fetch'))) {
		throw new Error('isNetworkFailure Failed to fetch');
	}
	if (!isNetworkFailure(new Error('Load failed'))) {
		throw new Error('isNetworkFailure Load failed');
	}
	if (!isNetworkFailure(new Error('errors.timeout'))) {
		throw new Error('isNetworkFailure timeout');
	}
	if (isNetworkFailure(new Error('JWT expired'))) {
		throw new Error('isNetworkFailure should ignore JWT errors');
	}
	if (isNetworkFailure({ status: 500, message: 'Internal' })) {
		throw new Error('isNetworkFailure should ignore HTTP 500');
	}
}
