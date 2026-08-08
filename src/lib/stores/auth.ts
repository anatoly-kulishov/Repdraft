import { browser } from '$app/environment';
import { getSupabase, isSupabaseConfigured } from '$lib/supabase/client';
import { migrateLocalToCloud, setCloudMode } from '$lib/storage/dataAccess';
import type { Session, User } from '@supabase/supabase-js';
import { writable } from 'svelte/store';
import { plans } from './plans';
import { records } from './records';

type AuthState = {
	configured: boolean;
	ready: boolean;
	session: Session | null;
	user: User | null;
};

function createAuthStore() {
	const { subscribe, set } = writable<AuthState>({
		configured: false,
		ready: false,
		session: null,
		user: null
	});

	/** Skip duplicate INITIAL_SESSION from getSession + onAuthStateChange. */
	let lastUserId: string | null | undefined = undefined;

	async function applySession(session: Session | null, opts?: { force?: boolean }) {
		const loggedIn = Boolean(session?.user);
		const userId = session?.user?.id ?? null;
		if (!opts?.force && userId === lastUserId) {
			return;
		}
		lastUserId = userId;

		setCloudMode(loggedIn);
		set({
			configured: isSupabaseConfigured(),
			ready: true,
			session,
			user: session?.user ?? null
		});

		// Paint local (then cloud) immediately — never wait on migrate.
		void Promise.all([plans.refresh(), records.refresh()]);

		if (loggedIn) {
			void migrateLocalToCloud()
				.then(() => Promise.all([plans.refresh(), records.refresh()]))
				.catch((err) => console.error('migrateLocalToCloud failed', err));
		}
	}

	async function init() {
		if (!browser) {
			set({ configured: false, ready: true, session: null, user: null });
			return;
		}

		const configured = isSupabaseConfigured();
		if (!configured) {
			setCloudMode(false);
			set({ configured: false, ready: true, session: null, user: null });
			lastUserId = null;
			await Promise.all([plans.refresh(), records.refresh()]);
			return;
		}

		const supabase = getSupabase();
		if (!supabase) {
			set({ configured: true, ready: true, session: null, user: null });
			return;
		}

		const { data } = await supabase.auth.getSession();
		await applySession(data.session, { force: true });

		supabase.auth.onAuthStateChange((event, session) => {
			// getSession already applied the initial session.
			if (event === 'INITIAL_SESSION') return;
			void applySession(session);
		});
	}

	return {
		subscribe,
		init,
		async signUp(email: string, password: string) {
			const supabase = getSupabase();
			if (!supabase) throw new Error('Supabase не настроен');
			const { error } = await supabase.auth.signUp({ email, password });
			if (error) throw error;
		},
		async signIn(email: string, password: string) {
			const supabase = getSupabase();
			if (!supabase) throw new Error('Supabase не настроен');
			const { error } = await supabase.auth.signInWithPassword({ email, password });
			if (error) throw error;
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
