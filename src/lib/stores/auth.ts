import { browser } from '$app/environment';
import { getSupabase, isSupabaseConfigured } from '$lib/supabase/client';
import { migrateLocalToCloud, setCloudMode } from '$lib/storage/dataAccess';
import type { Provider, Session, User } from '@supabase/supabase-js';
import { writable } from 'svelte/store';
import { plans } from './plans';
import { records } from './records';

type AuthState = {
	configured: boolean;
	ready: boolean;
	session: Session | null;
	user: User | null;
	/** True after clicking a password-recovery email link. */
	passwordRecovery: boolean;
};

function authCallbackUrl(next?: string | null): string {
	const url = new URL('/auth', window.location.origin);
	if (next) url.searchParams.set('next', next);
	return url.toString();
}

function recoveryCallbackUrl(): string {
	const url = new URL('/auth', window.location.origin);
	url.searchParams.set('recovery', '1');
	return url.toString();
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		configured: false,
		ready: false,
		session: null,
		user: null,
		passwordRecovery: false
	});

	/** Skip duplicate INITIAL_SESSION from getSession + onAuthStateChange. */
	let lastUserId: string | null | undefined = undefined;
	let passwordRecovery = false;

	async function applySession(
		session: Session | null,
		opts?: { force?: boolean; passwordRecovery?: boolean }
	) {
		if (opts?.passwordRecovery !== undefined) {
			passwordRecovery = opts.passwordRecovery;
		}

		const loggedIn = Boolean(session?.user);
		const userId = session?.user?.id ?? null;
		if (!opts?.force && userId === lastUserId) {
			// Still publish recovery flag changes for the same user.
			update((s) =>
				s.passwordRecovery === passwordRecovery ? s : { ...s, passwordRecovery }
			);
			return;
		}
		lastUserId = userId;

		setCloudMode(loggedIn);
		set({
			configured: isSupabaseConfigured(),
			ready: true,
			session,
			user: session?.user ?? null,
			passwordRecovery
		});

		// Local first — cloud lists must not race page-critical fetches (technique clips).
		void Promise.all([plans.refresh({ cloud: false }), records.refresh({ cloud: false })]);

		const schedule =
			typeof requestIdleCallback === 'function'
				? (fn: () => void) => requestIdleCallback(fn, { timeout: 2500 })
				: (fn: () => void) => setTimeout(fn, 1200);

		schedule(() => {
			void Promise.all([plans.refresh(), records.refresh()]);
			if (!loggedIn) return;
			void migrateLocalToCloud()
				.then(() => Promise.all([plans.refresh(), records.refresh()]))
				.catch((err) => console.error('migrateLocalToCloud failed', err));
		});
	}

	async function init() {
		if (!browser) {
			set({
				configured: false,
				ready: true,
				session: null,
				user: null,
				passwordRecovery: false
			});
			return;
		}

		const configured = isSupabaseConfigured();
		if (!configured) {
			setCloudMode(false);
			set({
				configured: false,
				ready: true,
				session: null,
				user: null,
				passwordRecovery: false
			});
			lastUserId = null;
			passwordRecovery = false;
			await Promise.all([plans.refresh(), records.refresh()]);
			return;
		}

		const supabase = getSupabase();
		if (!supabase) {
			set({
				configured: true,
				ready: true,
				session: null,
				user: null,
				passwordRecovery: false
			});
			return;
		}

		const { data } = await supabase.auth.getSession();
		const hash = window.location.hash;
		const recoveryHint =
			hash.includes('type=recovery') ||
			new URLSearchParams(window.location.search).get('recovery') === '1';
		await applySession(data.session, {
			force: true,
			passwordRecovery: Boolean(recoveryHint && data.session)
		});

		supabase.auth.onAuthStateChange((event, session) => {
			if (event === 'PASSWORD_RECOVERY') {
				void applySession(session, { force: true, passwordRecovery: true });
				return;
			}
			if (event === 'INITIAL_SESSION') return;
			if (event === 'SIGNED_OUT') {
				void applySession(null, { force: true, passwordRecovery: false });
				return;
			}
			void applySession(session);
		});
	}

	return {
		subscribe,
		init,
		clearPasswordRecovery() {
			passwordRecovery = false;
			update((s) => ({ ...s, passwordRecovery: false }));
		},
		async signUp(email: string, password: string, next?: string | null) {
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
				options: { emailRedirectTo: authCallbackUrl(next) }
			});
			if (error) throw error;
			return { session: data.session };
		},
		async signIn(email: string, password: string) {
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const { error } = await supabase.auth.signInWithPassword({ email, password });
			if (error) throw error;
		},
		async signInWithOtp(email: string, next?: string | null) {
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const { error } = await supabase.auth.signInWithOtp({
				email,
				options: {
					emailRedirectTo: authCallbackUrl(next),
					shouldCreateUser: true
				}
			});
			if (error) throw error;
		},
		async signInWithOAuth(provider: Provider, next?: string | null) {
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const { error } = await supabase.auth.signInWithOAuth({
				provider,
				options: {
					redirectTo: authCallbackUrl(next),
					queryParams: { prompt: 'select_account' }
				}
			});
			if (error) throw error;
		},
		async resetPasswordForEmail(email: string) {
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const { error } = await supabase.auth.resetPasswordForEmail(email, {
				redirectTo: recoveryCallbackUrl()
			});
			if (error) throw error;
		},
		async updatePassword(password: string) {
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const { error } = await supabase.auth.updateUser({ password });
			if (error) throw error;
			passwordRecovery = false;
			update((s) => ({ ...s, passwordRecovery: false }));
		},
		async signOut() {
			const supabase = getSupabase();
			if (!supabase) return;
			const { error } = await supabase.auth.signOut();
			if (error) throw error;
		}
	};
}

export const auth = createAuthStore();
