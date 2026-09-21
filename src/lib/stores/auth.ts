import { browser } from '$app/environment';
import { webApiOrigin } from '$lib/app/native';
import { resolveAuthBootSession } from '$lib/domain/authBoot';
import { userCustomAvatarPath } from '$lib/domain/authFlow';
import type { LocalCacheUserAction } from '$lib/domain/localCacheUser';
import {
	hasCloudWorkoutData,
	hasLocalGuestWorkoutData,
	type LocalMergeChoice
} from '$lib/domain/localMergeConflict';
import { SUPABASE_AUTH_MS } from '$lib/domain/networkTimeouts';
import { withTimeout } from '$lib/domain/withTimeout';
import { translate } from '$lib/i18n/messages';
import { compressAvatarImage } from '$lib/media/avatarImage';
import {
	migrateLocalToCloud,
	peekCloudWorkoutPresence,
	peekLocalGuestWorkoutPresence,
	setCloudMode
} from '$lib/storage/dataAccess';
import { removeAvatar, uploadAvatar } from '$lib/storage/avatarsRepository';
import { syncHomeBootPeek } from '$lib/storage/homeBootPeek';
import {
	clearUserLocalData,
	discardGuestLocalWorkoutData,
	LOCAL_CACHE_USER_KEY,
	peekLikelySignedInUserId,
	peekSupabaseStoredUserStub,
	syncLocalCacheUser
} from '$lib/storage/localUserCache';
import { peekHasLocalPlans, syncHomePlansBootCookie } from '$lib/storage/localWorkoutRepository';
import { wipeAllAppStorage } from '$lib/storage/wipeAppStorage';
import { getSupabase, isSupabaseConfigured } from '$lib/supabase/client';
import type { Session, User } from '@supabase/supabase-js';
import { get, writable } from 'svelte/store';
import { bookmarks } from './bookmarks';
import { draft } from './draft';
import { greetingName } from './greetingName';
import { live } from './live';
import { localMergeConflict } from './localMergeConflict';
import { plans } from './plans';
import { records } from './records';
import { resolvedLocale } from './locale';
import { toasts } from './toasts';

type AuthState = {
	configured: boolean;
	ready: boolean;
	/**
	 * True after the first getSession / applySession (or when cloud is off).
	 * `ready` can unlock shell earlier; do not treat user as guest until this is true.
	 */
	sessionKnown: boolean;
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

function recoveryCallbackUrl(next?: string | null): string {
	const url = new URL('/auth', window.location.origin);
	url.searchParams.set('recovery', '1');
	if (next) url.searchParams.set('next', next);
	return url.toString();
}

function createAuthStore() {
	const store = writable<AuthState>({
		configured: false,
		ready: false,
		sessionKnown: false,
		dataBootstrap: !browser,
		session: null,
		user: null,
		passwordRecovery: false
	});
	const { subscribe, set, update } = store;

	async function runCloudBootstrap(
		loggedIn: boolean,
		opts: { cacheAction: LocalCacheUserAction }
	) {
		try {
			let conflictChoice: LocalMergeChoice | null = null;
			let silentMigrate = false;

			if (loggedIn && opts.cacheAction === 'bind-first') {
				const localPresence = await peekLocalGuestWorkoutPresence();
				if (hasLocalGuestWorkoutData(localPresence)) {
					const cloudPresence = await peekCloudWorkoutPresence();
					if (hasCloudWorkoutData(cloudPresence)) {
						conflictChoice = await localMergeConflict.awaitChoice();
						if (conflictChoice === 'discard') {
							discardGuestLocalWorkoutData();
							draft.resetDraft();
							live.resetHistoryHydration();
							live.hydrate();
							plans.invalidate();
							records.invalidate();
						} else if (conflictChoice === 'merge') {
							toasts.show(
								translate(get(resolvedLocale), 'auth.mergeConflictKeepToast'),
								'success'
							);
						} else {
							const _exhaustive: never = conflictChoice;
							void _exhaustive;
						}
					} else {
						silentMigrate = true;
					}
				}
			}

			/* Serial cloud pulls — parallel hung workout_sessions + technique_clips starved the pool. */
			await plans.refresh();
			await records.refresh();
			await live.refreshHistory();
			if (loggedIn) {
				if (conflictChoice !== 'discard') {
					await migrateLocalToCloud();
					await plans.refresh();
					await records.refresh();
					await live.refreshHistory();
				}
				if (conflictChoice === 'discard') {
					toasts.show(
						translate(get(resolvedLocale), 'auth.mergeConflictDiscardToast'),
						'info'
					);
				} else if (silentMigrate) {
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
				bookmarks.refresh()
			]);
			// History: hydrate seeds local + refreshHistory({ cloud:false }); cloud merge in runCloudBootstrap.
			void live.refreshHistory({ cloud: false });
		} catch (err) {
			console.error('local bootstrap failed', err);
		} finally {
			update((s) => ({ ...s, dataBootstrap: true }));
			live.resyncActiveFromStorage();
		}

		void runCloudBootstrap(loggedIn, { cacheAction: opts.cacheAction });
	}

	/** Skip duplicate INITIAL_SESSION from getSession + onAuthStateChange. */
	let lastUserId: string | null | undefined = undefined;
	let passwordRecovery = false;
	/** True only for explicit sign-out / wipe / delete — soft SIGNED_OUT keeps local cache. */
	let allowClearOnSignOut = false;

	function markAccountBootCookies() {
		if (!browser) return;
		try {
			document.cookie = 'repdraft_auth_boot=1; path=/; Max-Age=31536000; SameSite=Lax';
			document.documentElement.dataset.authBoot = 'account';
			syncHomeBootPeek('start');
		} catch {
			/* ignore */
		}
	}

	function stubUserFromLocalPeek(userId: string): User {
		const stub = peekSupabaseStoredUserStub();
		const base = stub && stub.id === userId ? stub : { id: userId };
		return {
			id: base.id,
			email: base.email,
			user_metadata: base.user_metadata ?? {},
			app_metadata: {},
			aud: 'authenticated',
			created_at: ''
		} as User;
	}

	/**
	 * Offline / timed-out getSession: keep plans & greeting, unlock Home.
	 * Do not call syncLocalCacheUser(null) — that wiped the device on timeout.
	 */
	async function continueWithLocalAccount(reason: string) {
		const userId = peekLikelySignedInUserId();
		if (!userId) {
			await applySession(null, { force: true, passwordRecovery: false });
			return;
		}
		console.warn(`auth ${reason} — continuing with local account data`);
		/* Distinct from real user id so a later session apply is not skipped as duplicate. */
		lastUserId = `__local__:${userId}`;
		passwordRecovery = false;
		markAccountBootCookies();
		setCloudMode(true);
		const user = stubUserFromLocalPeek(userId);
		set({
			configured: isSupabaseConfigured(),
			ready: true,
			sessionKnown: true,
			dataBootstrap: false,
			session: null,
			user,
			passwordRecovery: false
		});
		greetingName.bindUser(user);
		void runDataBootstrap(true, { cacheCleared: false, cacheAction: 'noop' });
	}

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
					markAccountBootCookies();
				} else {
					document.cookie = 'repdraft_auth_boot=; path=/; Max-Age=0; SameSite=Lax';
					document.documentElement.dataset.authBoot = 'guest';
					syncHomePlansBootCookie(peekHasLocalPlans());
				}
			} catch {
				/* ignore cookie / dataset failures */
			}
		}

		setCloudMode(loggedIn);
		set({
			configured: isSupabaseConfigured(),
			ready: true,
			sessionKnown: true,
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
				sessionKnown: true,
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
				sessionKnown: true,
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
				sessionKnown: true,
				dataBootstrap: true,
				session: null,
				user: null,
				passwordRecovery: false
			});
			return;
		}

		/* Unlock shell chrome immediately; getSession may hang on slow networks.
		 * Keep sessionKnown false so UI does not flash guest for signed-in peeks. */
		set({
			configured: true,
			ready: true,
			sessionKnown: false,
			dataBootstrap: false,
			session: null,
			user: null,
			passwordRecovery: false
		});

		let session: Session | null = null;
		let getSessionFailed = false;
		try {
			const { data } = await withTimeout(supabase.auth.getSession(), SUPABASE_AUTH_MS);
			session = data.session;
		} catch (err) {
			getSessionFailed = true;
			console.warn('auth getSession timed out — continuing with local data', err);
		}
		const hash = window.location.hash;
		const recoveryHint =
			hash.includes('type=recovery') ||
			new URLSearchParams(window.location.search).get('recovery') === '1';

		const boot = resolveAuthBootSession({
			hasSession: Boolean(session?.user),
			likelyUserId: peekLikelySignedInUserId()
		});
		if (boot.kind === 'local-account') {
			await continueWithLocalAccount(
				getSessionFailed ? 'getSession timeout' : 'getSession null with local peek'
			);
		} else {
			await applySession(session, {
				force: true,
				passwordRecovery: Boolean(recoveryHint && session)
			});
		}

		supabase.auth.onAuthStateChange((event, nextSession) => {
			if (event === 'PASSWORD_RECOVERY') {
				void applySession(nextSession, { force: true, passwordRecovery: true });
				return;
			}
			if (event === 'INITIAL_SESSION') return;
			if (event === 'SIGNED_OUT') {
				if (allowClearOnSignOut) {
					allowClearOnSignOut = false;
					void applySession(null, { force: true, passwordRecovery: false });
					return;
				}
				/* Soft logout: refresh failed offline / expired token without explicit sign-out. */
				if (peekLikelySignedInUserId()) {
					void continueWithLocalAccount('SIGNED_OUT soft');
					return;
				}
				void applySession(null, { force: true, passwordRecovery: false });
				return;
			}
			void applySession(nextSession);
		});
	}

	return {
		subscribe,
		init,
		clearPasswordRecovery() {
			passwordRecovery = false;
			update((s) => ({ ...s, passwordRecovery: false }));
		},
		async signUp(email: string, password: string, next?: string | null, captchaToken?: string) {
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
				options: {
					emailRedirectTo: authCallbackUrl(next),
					...(captchaToken ? { captchaToken } : {})
				}
			});
			if (error) throw error;
			return { session: data.session };
		},
		async signIn(email: string, password: string, captchaToken?: string) {
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const { error } = await supabase.auth.signInWithPassword({
				email,
				password,
				options: captchaToken ? { captchaToken } : undefined
			});
			if (error) throw error;
		},
		async signInWithOtp(email: string, next?: string | null, captchaToken?: string) {
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const { error } = await supabase.auth.signInWithOtp({
				email,
				options: {
					emailRedirectTo: authCallbackUrl(next),
					shouldCreateUser: true,
					...(captchaToken ? { captchaToken } : {})
				}
			});
			if (error) throw error;
		},
		async resetPasswordForEmail(
			email: string,
			captchaToken?: string,
			next?: string | null
		) {
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const { error } = await supabase.auth.resetPasswordForEmail(email, {
				redirectTo: recoveryCallbackUrl(next),
				...(captchaToken ? { captchaToken } : {})
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
		async uploadProfileAvatar(file: File): Promise<void> {
			if (!browser) throw new Error('auth.avatar.uploadFail');
			const current = get(store).user;
			if (!current?.id) throw new Error('auth.avatar.uploadFail');
			const previousPath = userCustomAvatarPath(current);
			const compressed = await compressAvatarImage(file);
			const { user: next } = await uploadAvatar(
				current.id,
				compressed.blob,
				compressed.contentType,
				compressed.ext,
				previousPath
			);
			update((s) => ({
				...s,
				user: next,
				session: s.session ? { ...s.session, user: next } : s.session
			}));
		},
		async removeProfileAvatar(): Promise<void> {
			if (!browser) throw new Error('auth.avatar.removeFail');
			const current = get(store).user;
			if (!current?.id) throw new Error('auth.avatar.removeFail');
			const path = userCustomAvatarPath(current);
			const next = await removeAvatar(current.id, path);
			update((s) => ({
				...s,
				user: next,
				session: s.session ? { ...s.session, user: next } : s.session
			}));
		},
		async signOut() {
			const supabase = getSupabase();
			if (!supabase) return;
			allowClearOnSignOut = true;
			const { error } = await supabase.auth.signOut({ scope: 'local' });
			if (error) {
				allowClearOnSignOut = false;
				throw error;
			}
		},
		async signOutEverywhere() {
			const supabase = getSupabase();
			if (!supabase) return;
			allowClearOnSignOut = true;
			const { error } = await supabase.auth.signOut({ scope: 'global' });
			if (error) {
				allowClearOnSignOut = false;
				throw error;
			}
		},
		/** Wipe cloud account + local cache. Requires server SUPABASE_SERVICE_ROLE_KEY. */
		async deleteAccount() {
			const supabase = getSupabase();
			if (!supabase) throw new Error('errors.cloudOff');
			const {
				data: { session }
			} = await supabase.auth.getSession();
			if (!session?.access_token) throw new Error('auth.deleteUnauthorized');

			const origin = webApiOrigin();
			const deleteUrl = origin ? `${origin}/api/account/delete` : '/api/account/delete';
			const res = await fetch(deleteUrl, {
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

			allowClearOnSignOut = true;
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
			allowClearOnSignOut = true;
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
