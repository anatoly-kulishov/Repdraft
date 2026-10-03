import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')) as {
	version: string;
};

export default defineConfig(({ mode }) => {
	/**
	 * `define` below resolves PUBLIC_* from process.env, which never sees .env on its own.
	 * Without loadEnv every PUBLIC_* in .env was invisible to the build: sitemap/robots
	 * prerendered 503 (no origin) and `npm run build` aborted. process.env wins so CI and
	 * Vercel keep precedence; .env is the local fallback.
	 */
	const fileEnv = loadEnv(mode, root, '');
	const pub = (key: string): string => process.env[key] ?? fileEnv[key] ?? '';

	// Production prerender bakes canonical/og into HTML. Without PUBLIC_SITE_URL those
	// tags are omitted (sveltekit-prerender is rejected) and /sitemap.xml prerenders 503.
	// Warn instead of failing so a missing shared-env link cannot block Production;
	// set the var on the project and redeploy for full SEO.
	if (process.env.VERCEL_ENV === 'production' && !pub('PUBLIC_SITE_URL').trim()) {
		console.warn(
			'[seo] PUBLIC_SITE_URL is unset on this Production build. Set https://www.repdraft.xyz on the Vercel project (not only Shared) and redeploy for canonical/og URLs.'
		);
	}

	return {
		plugins: [tailwindcss(), sveltekit()],
		resolve: {
			// Vercel sveltekit entrypoints only advertise the `svelte` export condition.
			alias: {
				'@vercel/analytics/sveltekit': `${root}node_modules/@vercel/analytics/dist/sveltekit/index.mjs`,
				'@vercel/speed-insights/sveltekit': `${root}node_modules/@vercel/speed-insights/dist/sveltekit/index.mjs`
			}
		},
		build: {
			target: 'es2020',
			cssMinify: 'lightningcss'
		},
		define: {
			// Keep footer / build in sync with package.json (release tags = v{version}).
			'import.meta.env.PUBLIC_APP_VERSION': JSON.stringify(pkg.version),
			'import.meta.env.PUBLIC_PRIVACY_CONTACT_EMAIL': JSON.stringify(
				pub('PUBLIC_PRIVACY_CONTACT_EMAIL')
			),
			'import.meta.env.PUBLIC_PRIVACY_OPERATOR_NAME': JSON.stringify(
				pub('PUBLIC_PRIVACY_OPERATOR_NAME')
			),
			'import.meta.env.PUBLIC_PRIVACY_OPERATOR_INN': JSON.stringify(
				pub('PUBLIC_PRIVACY_OPERATOR_INN')
			),
			'import.meta.env.PUBLIC_PRIVACY_OPERATOR_ADDRESS': JSON.stringify(
				pub('PUBLIC_PRIVACY_OPERATOR_ADDRESS')
			),
			'import.meta.env.PUBLIC_SITE_URL': JSON.stringify(pub('PUBLIC_SITE_URL')),
			'import.meta.env.PUBLIC_WEB_ORIGIN': JSON.stringify(pub('PUBLIC_WEB_ORIGIN'))
		},
		server: {
			host: true, // LAN: phone can open http://<your-ip>:5173
			port: 5173
		},
		preview: {
			host: true,
			port: 4173
		}
	};
});
