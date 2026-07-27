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
	const { subscribe, set, update } = writable<AuthState>({
		configured: false,
		ready: false,
		session: null,
		user: null
	});

	async function applySession(session: Session | null) {
		const loggedIn = Boolean(session?.user);
		setCloudMode(loggedIn);
		set({
			configured: isSupabaseConfigured(),
			ready: true,
			session,
			user: session?.user ?? null
		});

		if (loggedIn) {
			try {
				await migrateLocalToCloud();
			} catch (err) {
				console.error('migrateLocalToCloud failed', err);
			}
		}

		await Promise.all([plans.refresh(), records.refresh()]);
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
			await Promise.all([plans.refresh(), records.refresh()]);
			return;
		}

		const supabase = getSupabase();
		if (!supabase) {
			set({ configured: true, ready: true, session: null, user: null });
			return;
		}

		const { data } = await supabase.auth.getSession();
		await applySession(data.session);

		supabase.auth.onAuthStateChange((_event, session) => {
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
