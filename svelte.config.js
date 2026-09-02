import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// ponytail: prerender only explicit public routes — do not crawl into /exercise/*
		prerender: {
			crawl: false,
			handleUnseenRoutes: 'ignore'
		},
		// ponytail: offline PWA QA only on build/preview — Vite dev URLs are not precacheable
		serviceWorker: {
			register: process.env.NODE_ENV === 'production'
		}
	}
};

export default config;
