/// <reference types="@sveltejs/kit" />
import { build, version } from '$service-worker';

/**
 * Minimal SW for installability + app-shell cache.
 * Do not precache static/images|videos — catalog media is huge.
 */
const CACHE = `repdraft-shell-${version}`;
const SHELL = build.filter((path) => !path.includes('/videos/') && !path.includes('/images/'));

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE) await caches.delete(key);
			}
			await self.clients.claim();
		})
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	event.respondWith(
		(async () => {
			const cached = await caches.match(request);
			if (cached && SHELL.includes(url.pathname)) return cached;

			try {
				const response = await fetch(request);
				return response;
			} catch {
				if (cached) return cached;
				throw new Error('network unavailable');
			}
		})()
	);
});
