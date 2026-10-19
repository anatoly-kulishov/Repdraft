import * as Linking from 'expo-linking';
import { authErrorMessageKey, parseEmailAuthLink, type EmailAuthLink } from '@repdraft/domain/authFlow';
import { getSupabase } from './supabase';

export type ConsumedAuthLink =
	| { status: 'empty' }
	| { status: 'session' }
	| { status: 'recovery' }
	| { status: 'error'; key: string | null; fallback: string };

const inflight = new Map<string, Promise<ConsumedAuthLink>>();

export function authEmailRedirect(): string {
	return Linking.createURL('auth');
}

function errorResult(err: unknown, fallback: string): ConsumedAuthLink {
	return { status: 'error', key: authErrorMessageKey(err), fallback };
}

async function consumeOnce(parsed: EmailAuthLink): Promise<ConsumedAuthLink> {
	if (parsed.kind === 'error') return errorResult({ message: parsed.description }, parsed.description);
	const sb = getSupabase();
	if (!sb) return { status: 'error', key: 'errors.cloudOff', fallback: '' };

	if (parsed.kind === 'pkce') {
		let recovery = false;
		const { data: sub } = sb.auth.onAuthStateChange((event) => {
			if (event === 'PASSWORD_RECOVERY') recovery = true;
		});
		const { error } = await sb.auth.exchangeCodeForSession(
			parsed.code,
			parsed.flowId ? { flowId: parsed.flowId } : undefined
		);
		sub.subscription.unsubscribe();
		if (error) return errorResult(error, error.message);
		return { status: recovery ? 'recovery' : 'session' };
	}

	const { error } = await sb.auth.setSession({
		access_token: parsed.accessToken,
		refresh_token: parsed.refreshToken
	});
	if (error) return errorResult(error, error.message);
	return { status: parsed.recovery ? 'recovery' : 'session' };
}

/** One exchange per URL. A second caller awaits the same result (PKCE codes are single-use). */
export function consumeAuthUrl(url: string | null): Promise<ConsumedAuthLink> {
	if (!url) return Promise.resolve({ status: 'empty' });
	const parsed = parseEmailAuthLink(url);
	if (!parsed) return Promise.resolve({ status: 'empty' });
	const key =
		parsed.kind === 'pkce'
			? `pkce:${parsed.code}`
			: parsed.kind === 'implicit'
				? `implicit:${parsed.accessToken}`
				: `error:${parsed.description}`;
	const existing = inflight.get(key);
	if (existing) return existing;
	const pending = consumeOnce(parsed);
	inflight.set(key, pending);
	return pending;
}
