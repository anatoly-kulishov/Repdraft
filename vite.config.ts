import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const pkg = JSON.parse(
	readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')
) as { version: string };

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	define: {
		// Keep footer / build in sync with package.json (release tags = v{version}).
		'import.meta.env.PUBLIC_APP_VERSION': JSON.stringify(pkg.version)
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
