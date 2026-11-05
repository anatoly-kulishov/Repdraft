import { isAuthSessionMissingError } from '@supabase/supabase-js';
import { writable } from 'svelte/store';

/**
 * True when the cloud identity is provably dead — invalid/expired JWT or a
 * missing Supabase session — vs. a transient network/RPC failure or an RLS 403
 * (which can happen without any auth problem). Only these cases should escalate
 * to a real logout.
 */
export function isRevokedSessionError(err: unknown): boolean {
	if (isAuthSessionMissingError(err)) return true;
	if (err instanceof Error && err.message === 'errors.needAuth') return true;
	if (err && typeof err === 'object') {
		const code = (err as { code?: unknown }).code;
		const msg = (err as { message?: unknown }).message;
		const codeStr = typeof code === 'string' ? code : '';
		const msgStr = typeof msg === 'string' ? msg : '';
		if (codeStr === 'PGRST301' || codeStr === '401') return true;
		if (msgStr.includes('Auth session missing') || /invalid\s+jwt|jwt\s+expired/i.test(msgStr)) {
			return true;
		}
	}
	return false;
}

/**
 * Signals that the cloud identity is gone even though the UI still holds a
 * signed-in stub (expired/revoked refresh token, account signed out elsewhere,
 * invalid JWT). `auth` subscribes here and performs a real logout; cloud sync
 * layers report here instead of just swallowing the sync error into a toast.
 *
 * Kept in its own store type so `cloudLocal`/repositories can publish without
 * importing `auth` (otherwise auth → plans/records → cloudLocal → auth cycle).
 */
const report = writable(0, () => {
	/* no-op set function */
	return () => {
		/* no-op stop */
	};
});

export function reportRevokedSession(): void {
	report.update((n) => n + 1);
}

/** Subscribe to revoked-session events; fires once per detection. */
export function onRevokedSession(cb: () => void): () => void {
	return report.subscribe((n) => {
		if (n > 0) cb();
	});
}