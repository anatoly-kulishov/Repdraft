import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { getSupabase } from '$lib/supabase/client';
import { isNativeApp } from '$lib/app/native';
import { isAuthDeepLinkUrl } from '$lib/app/nativeUrls';

async function applyAuthUrl(raw: string): Promise<void> {
	if (!isAuthDeepLinkUrl(raw)) return;

	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return;
	}

	const supabase = getSupabase();
	if (!supabase) return;

	const hash = parsed.hash?.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
	const fromHash = new URLSearchParams(hash || '');
	const fromQuery = parsed.searchParams;

	const code = fromQuery.get('code') ?? fromHash.get('code');
	if (code) {
		await supabase.auth.exchangeCodeForSession(code);
		return;
	}

	const access_token = fromQuery.get('access_token') ?? fromHash.get('access_token');
	const refresh_token = fromQuery.get('refresh_token') ?? fromHash.get('refresh_token');
	if (access_token && refresh_token) {
		await supabase.auth.setSession({ access_token, refresh_token });
	}
}

/**
 * Handle `repdraft://auth?...` (and https /auth opens that land as appUrlOpen).
 * Feeds tokens into supabase.auth so magic-link / recovery hydrate the session.
 */
export function installNativeAuthDeepLinks(): () => void {
	if (!isNativeApp()) return () => {};

	const onOpen = (event: URLOpenListenerEvent) => {
		const raw = event.url?.trim();
		if (!raw) return;
		void applyAuthUrl(raw).catch(() => {
			/* Invalid / expired link — auth UI stays signed out */
		});
	};

	let remove: (() => void) | undefined;
	void App.addListener('appUrlOpen', onOpen).then((handleRef) => {
		remove = () => {
			void handleRef.remove();
		};
	});

	return () => {
		remove?.();
	};
}
