/** Stub for domain selfchecks that import `$lib/server/*` (SvelteKit `$env`). */
export const env = new Proxy(
	{},
	{
		get: () => undefined
	}
);
