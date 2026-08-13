export type LocalCacheUserAction = 'noop' | 'bind-first' | 'clear-logout' | 'clear-switch';

/** Decide whether device cache belongs to another account and should be wiped. */
export function localCacheUserAction(
	cachedUserId: string | null,
	nextUserId: string | null
): { action: LocalCacheUserAction; shouldClear: boolean } {
	if (nextUserId === cachedUserId) {
		return { action: 'noop', shouldClear: false };
	}
	if (!nextUserId) {
		return { action: 'clear-logout', shouldClear: true };
	}
	if (cachedUserId && cachedUserId !== nextUserId) {
		return { action: 'clear-switch', shouldClear: true };
	}
	return { action: 'bind-first', shouldClear: false };
}

export function runLocalCacheUserSelfCheck(): void {
	if (localCacheUserAction('a', 'a').action !== 'noop') {
		throw new Error('same user should noop');
	}
	if (localCacheUserAction('a', null).shouldClear !== true) {
		throw new Error('logout should clear');
	}
	if (localCacheUserAction('a', 'b').action !== 'clear-switch') {
		throw new Error('switch should clear');
	}
	if (localCacheUserAction(null, 'a').shouldClear !== false) {
		throw new Error('guest → first login should keep local for migrate');
	}
}
