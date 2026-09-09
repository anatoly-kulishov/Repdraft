import adapterStatic from '@sveltejs/adapter-static';
import adapterVercel from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isCapacitor = process.env.APP_TARGET === 'capacitor';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: isCapacitor
			? adapterStatic({
					fallback: 'index.html',
					pages: 'build',
					assets: 'build',
					strict: false
				})
			: adapterVercel(),
		// ponytail: prerender only explicit public routes — do not crawl into /exercise/*
		prerender: {
			crawl: false,
			handleUnseenRoutes: 'ignore'
		},
		// Offline PWA SW: web production only. Native shell uses filesystem cache (stage 3).
		serviceWorker: {
			register: process.env.NODE_ENV === 'production' && !isCapacitor
		}
	}
};

export default config;
