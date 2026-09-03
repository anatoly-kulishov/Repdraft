import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')) as {
	version: string;
};

export default defineConfig({
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
			process.env.PUBLIC_PRIVACY_CONTACT_EMAIL ?? ''
		),
		'import.meta.env.PUBLIC_PRIVACY_OPERATOR_NAME': JSON.stringify(
			process.env.PUBLIC_PRIVACY_OPERATOR_NAME ?? ''
		),
		'import.meta.env.PUBLIC_PRIVACY_OPERATOR_INN': JSON.stringify(
			process.env.PUBLIC_PRIVACY_OPERATOR_INN ?? ''
		),
		'import.meta.env.PUBLIC_PRIVACY_OPERATOR_ADDRESS': JSON.stringify(
			process.env.PUBLIC_PRIVACY_OPERATOR_ADDRESS ?? ''
		),
		'import.meta.env.PUBLIC_SITE_URL': JSON.stringify(process.env.PUBLIC_SITE_URL ?? '')
	},
	server: {
		host: true, // LAN: phone can open http://<your-ip>:5173
		port: 5173
	},
	preview: {
		host: true,
		port: 4173
	}
});
