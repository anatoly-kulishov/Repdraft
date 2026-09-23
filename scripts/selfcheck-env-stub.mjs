/**
 * Stub for domain/AI selfchecks that import `$lib/server/*` (SvelteKit `$env`).
 * Forwards to `process.env` so `node --env-file=.env …` can exercise live AI.
 * Without env vars, `resolveAiConfig()` stays null (offline selfchecks / CI).
 */
export const env = new Proxy(
	{},
	{
		get: (_t, prop) => {
			if (typeof prop !== 'string') return undefined;
			const v = process.env[prop];
			return v === undefined || v === '' ? undefined : v;
		}
	}
);
