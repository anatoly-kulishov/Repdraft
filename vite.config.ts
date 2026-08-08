import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: true, // LAN: phone can open http://<your-ip>:5173
		port: 5173
	},
	preview: {
		host: true,
		port: 4173
	}
});
