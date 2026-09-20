import adapterVercel from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapterVercel(),
		// ponytail: prerender only explicit public routes — do not crawl into /exercise/*
		prerender: {
			crawl: false,
			handleUnseenRoutes: 'ignore'
		},
		serviceWorker: {
			register: process.env.NODE_ENV === 'production'
		}
	}
};

export default config;
