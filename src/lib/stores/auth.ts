import { browser } from '$app/environment';
import { SUPABASE_AUTH_MS } from '$lib/domain/networkTimeouts';
import { withTimeout } from '$lib/domain/withTimeout';
import { getSupabase, isSupabaseConfigured } from '$lib/supabase/client';
import { migrateLocalToCloud, setCloudMode } from '$lib/storage/dataAccess';
import {
	clearUserLocalData,
	LOCAL_CACHE_USER_KEY,
	syncLocalCacheUser
} from '$lib/storage/localUserCache';
import { wipeAllAppStorage } from '$lib/storage/wipeAppStorage';
import { localRecordRepository } from '$lib/storage/localRecordRepository';
import { localSessionRepository } from '$lib/storage/localSessionRepository';
import { localWorkoutRepository } from '$lib/storage/localWorkoutRepository';
import type { LocalCacheUserAction } from '$lib/domain/localCacheUser';
import { translate } from '$lib/i18n/messages';
import type { Provider, Session, User } from '@supabase/supabase-js';
import { get, writable } from 'svelte/store';
import { draft } from './draft';
import { greetingName } from './greetingName';
import { live } from './live';
import { plans } from './plans';
import { records } from './records';
import { bookmarks } from './bookmarks';
import { resolvedLocale } from './locale';
import { toasts } from './toasts';

type AuthState = {
	configured: boolean;
	ready: boolean;
	/** False while initial local plans/records hydrate is in flight. */
	dataBootstrap: boolean;
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
		dataBootstrap: !browser,
		session: null,
		user: null,
		passwordRecovery: false
	});

	async function runCloudBootstrap(
		loggedIn: boolean,
		opts: { cacheAction: LocalCacheUserAction }
	) {
		try {
			await Promise.all([plans.refresh(), records.refresh(), live.refreshHistory()]);
			if (loggedIn) {
				let hadGuestData = false;
				if (opts.cacheAction === 'bind-first') {
					const [plansLocal, sessionsLocal, recordsLocal] = await Promise.all([
						localWorkoutRepository.list(),
						localSessionRepository.list(),
						localRecordRepository.list()
					]);
					hadGuestData =
						plansLocal.length > 0 || sessionsLocal.length > 0 || recordsLocal.length > 0;
				}
				await migrateLocalToCloud();
				await Promise.all([plans.refresh(), records.refresh(), live.refreshHistory()]);
				if (hadGuestData) {
					toasts.show(translate(get(resolvedLocale), 'auth.migrateLocalHint'), 'info');
				}
			}
		} catch (err) {
			console.warn('cloud bootstrap failed', err);
		}
	}

	async function runDataBootstrap(
		loggedIn: boolean,
		opts: { cacheCleared: boolean; cacheAction: LocalCacheUserAction }
	) {
		update((s) => ({ ...s, dataBootstrap: false }));
		try {
			if (opts.cacheCleared) {
				draft.resetDraft();
				live.resetHistoryHydration();
				live.hydrate();
				plans.invalidate();
				records.invalidate();
				bookmarks.invalidate();
			}
			await Promise.all([
				plans.refresh({ cloud: false }),
				records.refresh({ cloud: false }),
				bookmarks.refresh(),
				live.refreshHistory()
			]);
		} catch (err) {
			console.error('local bootstrap failed', err);
		} finally {
			update((s) => ({ ...s, dataBootstrap: true }));
		}

		void runCloudBootstrap(loggedIn, { cacheAction: opts.cacheAction });
	}

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

		const cacheSync = browser
			? syncLocalCacheUser(userId)
			: { cleared: false, action: 'noop' as const };

		if (browser) {
			try {
				if (loggedIn) {
					document.cookie = 'repdraft_auth_boot=1; path=/; Max-Age=31536000; SameSite=Lax';
					document.documentElement.dataset.authBoot = 'account';
				} else {
					document.cookie = 'repdraft_auth_boot=; path=/; Max-Age=0; SameSite=Lax';
					document.documentElement.dataset.authBoot = 'guest';
				}
			} catch {
				/* ignore cookie / dataset failures */
			}
		}

		setCloudMode(loggedIn);
		set({
			configured: isSupabaseConfigured(),
			ready: true,
			dataBootstrap: false,
			session,
			user: session?.user ?? null,
			passwordRecovery
		});

		greetingName.bindUser(session?.user ?? null);

		void runDataBootstrap(loggedIn, {
			cacheCleared: cacheSync.cleared,
			cacheAction: cacheSync.action
		});
	}

	async function init() {
		if (!browser) {
			set({
				configured: false,
				ready: true,
				dataBootstrap: true,
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
				dataBootstrap: false,
				session: null,
				user: null,
				passwordRecovery: false
			});
			lastUserId = null;
			passwordRecovery = false;
			await runDataBootstrap(false, { cacheCleared: false, cacheAction: 'noop' });
			return;
		}

		const supabase = getSupabase();
		if (!supabase) {
			set({
				configured: true,
				ready: true,
				dataBootstrap: true,
				session: null,
				user: null,
				passwordRecovery: false
			});
			return;
		}

		let session: Session | null = null;
		try {
			const { data } = await withTimeout(supabase.auth.getSession(), SUPABASE_AUTH_MS);
			session = data.session;
		} catch (err) {
			console.warn('auth getSession timed out — continuing with local data', err);
		}
		const hash = window.location.hash;
		const recoveryHint =
			hash.includes('type=recovery') ||
			new URLSearchParams(window.location.search).get('recovery') === '1';
		await applySession(session, {
			force: true,
			passwordRecovery: Boolean(recoveryHint && session)
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
		},
		/** Wipe cloud account + local cache. Requires server SUPABASE_SERVICE_ROLE_KEY. */
		async deleteAccount() {
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const {
				data: { session }
			} = await supabase.auth.getSession();
			if (!session?.access_token) throw new Error('auth.deleteUnauthorized');

			const res = await fetch('/api/account/delete', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${session.access_token}`,
					Accept: 'application/json'
				}
			});
			const body = (await res.json().catch(() => null)) as { error?: string } | null;
			if (!res.ok) {
				throw new Error(body?.error || 'auth.deleteFail');
			}

			clearUserLocalData();
			if (typeof localStorage !== 'undefined') {
				localStorage.removeItem(LOCAL_CACHE_USER_KEY);
			}
			await supabase.auth.signOut({ scope: 'local' });
			await applySession(null, { force: true, passwordRecovery: false });
		},
		/** QA: wipe on-device storage and sign out locally. Cloud account stays. */
		async wipeLocalProfileForTesting(): Promise<void> {
			const supabase = getSupabase();
			if (supabase) {
				try {
					await supabase.auth.signOut({ scope: 'local' });
				} catch {
					/* offline ok */
				}
			}
			await wipeAllAppStorage();
			setCloudMode(false);
			draft.resetDraft();
			live.resetHistoryHydration();
			plans.invalidate();
			records.invalidate();
			bookmarks.invalidate();
			await applySession(null, { force: true, passwordRecovery: false });
		}
	};
}

export const auth = createAuthStore();
