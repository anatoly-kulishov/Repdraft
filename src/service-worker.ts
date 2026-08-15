/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

/**
 * Minimal SW for installability + app-shell cache.
 * Do not precache static/images|videos — catalog media is huge.
 */
const CACHE = `repdraft-shell-${version}`;
const CATALOG_INDEX = '/data/exercises.index.json';

const SHELL = [
	...build.filter((path) => !path.includes('/videos/') && !path.includes('/images/')),
	...files.filter(
		(path) =>
			path === CATALOG_INDEX ||
			path === '/manifest.webmanifest' ||
			(/^\/icon/.test(path) && !path.includes('light'))
	)
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(SHELL))
			.then(() => self.skipWaiting())
	);
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

async function staleWhileRevalidate(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	const cached = await cache.match(request);
	const network = fetch(request)
		.then((response) => {
			if (response.ok) void cache.put(request, response.clone());
			return response;
		})
		.catch(() => null);
	if (cached) {
		void network;
		return cached;
	}
	const fresh = await network;
	if (fresh) return fresh;
	throw new Error('network unavailable');
}

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (url.pathname === CATALOG_INDEX) {
		event.respondWith(staleWhileRevalidate(request));
		return;
	}

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
