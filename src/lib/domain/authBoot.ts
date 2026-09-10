/**
 * First-paint auth resolution: prefer a real session; otherwise keep local
 * account cache when peeks say the device still belongs to a signed-in user.
 * Avoids wipe-on-timeout / wipe-on-offline-refresh that emptied Home offline.
 */

export type AuthBootResolution =
	| { kind: 'session' }
	| { kind: 'local-account'; userId: string }
	| { kind: 'guest' };

export function resolveAuthBootSession(opts: {
	hasSession: boolean;
	likelyUserId: string | null;
}): AuthBootResolution {
	if (opts.hasSession) return { kind: 'session' };
	const id = opts.likelyUserId?.trim() || null;
	if (id) return { kind: 'local-account', userId: id };
	return { kind: 'guest' };
}
