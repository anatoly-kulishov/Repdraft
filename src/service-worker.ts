/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

/**
 * App shell + immutable bundles for offline PWA.
 * Exercise JPG thumbs (~11 MB) precached on install; GIFs cache on view (~125 MB total).
 * Catalog JSON + icons precached with shell.
 *
 * Offline QA: use production build (`npm run preview`), not `npm run dev` —
 * Vite dev serves uncacheable module URLs under /.svelte-kit and /@id.
 */
const SW_NAVIGATION_MS = 5000;
const CACHE = `repdraft-shell-${version}`;
const MEDIA_CACHE = `repdraft-media-${version}`;
const APP_SHELL = '/';
const DEV = import.meta.env.DEV;

const BUILD_ASSETS = build.filter(
	(path) => !path.includes('/videos/') && !path.includes('/images/')
);
const BUILD_PATHS = new Set(BUILD_ASSETS);

const STATIC_ESSENTIALS = files.filter(
	(path) =>
		path === '/manifest.webmanifest' ||
		((path.startsWith('/data/') || path.startsWith('/content/')) && path.endsWith('.json')) ||
		/^\/icon/.test(path)
);

/**
 * SvelteKit runtime modules are generated per build and are NOT part of `build`.
 * Without `/_app/env.js` a cold offline boot dies on a dynamic import and the app
 * stays on the skeleton forever (found in Phase 0 offline audit).
 */
const RUNTIME_ESSENTIALS = ['/_app/env.js', '/_app/version.json'];
const OFFLINE_PAGE = '/offline.html';

/** Honest offline screen for deep links never cached on this device. */
const OFFLINE_ESSENTIALS = [OFFLINE_PAGE];

/** Small static shell brand assets (splash/logo) the app requests before paint. */
const BRAND_ESSENTIALS = files.filter((path) => /^\/(brand-|favicon|apple-touch)/.test(path));

/** All catalog list thumbs — small enough to precache for offline browse. */
const IMAGE_PRECACHE = files.filter((path) => path.startsWith('/images/'));

const PRECACHE = [
	...BUILD_ASSETS,
	...STATIC_ESSENTIALS,
	...BRAND_ESSENTIALS,
	...RUNTIME_ESSENTIALS,
	...OFFLINE_ESSENTIALS
];
const PRECACHE_PATHS = new Set(PRECACHE);

function offlineResponse(): Response {
	return new Response('Offline', {
		status: 503,
		statusText: 'Offline',
		headers: { 'Content-Type': 'text/plain; charset=utf-8' }
	});
}

function isNavigationRequest(request: Request): boolean {
	return (
		request.mode === 'navigate' ||
		(request.headers.get('accept')?.includes('text/html') ?? false)
	);
}

function isStaticJson(pathname: string): boolean {
	return (
		pathname.includes('__data.json') ||
		((pathname.startsWith('/data/') || pathname.startsWith('/content/')) &&
			pathname.endsWith('.json'))
	);
}

function isStaticMedia(pathname: string): boolean {
	return pathname.startsWith('/images/') || pathname.startsWith('/videos/');
}

function isShellAsset(pathname: string): boolean {
	return BUILD_PATHS.has(pathname) || PRECACHE_PATHS.has(pathname) || pathname.startsWith('/_app/');
}

async function precacheAll(cache: Cache, urls: readonly string[]): Promise<void> {
	await Promise.all(
		urls.map(async (path) => {
			try {
				await cache.add(path);
			} catch {
				// ponytail: one 404 must not reject install and leave cache empty
			}
		})
	);
}

/** ponytail: 1300+ thumbs — batch so install does not open 1300 parallel fetches. */
async function precacheInBatches(
	cache: Cache,
	urls: readonly string[],
	batchSize = 32
): Promise<void> {
	for (let i = 0; i < urls.length; i += batchSize) {
		const batch = urls.slice(i, i + batchSize);
		await Promise.all(
			batch.map(async (path) => {
				try {
					await cache.add(path);
				} catch {
					// single missing thumb must not fail install
				}
			})
		);
	}
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await precacheAll(cache, PRECACHE);
			try {
				await cache.add(APP_SHELL);
			} catch {
				// first online navigation caches HTML
			}
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			for (const key of keys) {
				if (key !== CACHE && key !== MEDIA_CACHE) await caches.delete(key);
			}
			await self.clients.claim();
			// ponytail: ~1300 thumbs after shell — faster SW install / first paint
			const mediaCache = await caches.open(MEDIA_CACHE);
			void precacheInBatches(mediaCache, IMAGE_PRECACHE);
		})()
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
	return offlineResponse();
}

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	if (cached) return cached;
	try {
		const response = await fetch(request);
		if (response.ok) void cache.put(request, response.clone());
		return response;
	} catch {
		return offlineResponse();
	}
}

async function fetchWithTimeout(request: Request, ms: number): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ms);
	try {
		return await fetch(request, { signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

async function cachedAppShell(): Promise<Response | undefined> {
	const cache = await caches.open(CACHE);
	return (await cache.match(APP_SHELL)) ?? undefined;
}

/** HTML: network-first with timeout, cache hit, then shell (root only) or offline page. */
async function navigationNetworkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	/* Reported offline: skip the 5s network wait and serve the cache at once.
	 * (onLine can lie toward "online", so we only fast-path the explicit false.) */
	if (self.navigator?.onLine === false) {
		return offlineNavigationFallback(request, cache);
	}
	try {
		const response = await fetchWithTimeout(request, SW_NAVIGATION_MS);
		/* Redirected / non-ok responses cannot be stored by cache.put(). */
		if (response.ok && !response.redirected) void cache.put(request, response.clone());
		return response;
	} catch {
		return offlineNavigationFallback(request, cache);
	}
}

/** Offline navigation: cached page, else shell (root), else boot home, else offline page. */
async function offlineNavigationFallback(request: Request, cache: Cache): Promise<Response> {
	const cached = await cache.match(request);
	if (cached) return cached;

	const pathname = new URL(request.url).pathname;
	const shell = await cachedAppShell();

	/* The cached shell is SSR-rendered for `/`. Serving it at another path makes
	 * SvelteKit hydrate the wrong route and hang on a skeleton (Phase 0 audit). */
	if (pathname === '/') {
		if (shell) return shell;
	} else if (shell) {
		/* iOS standalone restores the last URL, not start_url. A never-cached deep
		 * link would dead-end on /offline.html even though the home works offline.
		 * Boot the offline-capable home instead via a real navigation (302 → `/`). */
		try {
			return Response.redirect(new URL('/', self.location.origin).href, 302);
		} catch {
			/* fall through to the offline page */
		}
	}

	const offline = await cache.match(OFFLINE_PAGE);
	if (offline) return offline;
	return offlineResponse();
}

/** JS/CSS from precache or /_app/immutable — cache-first (SvelteKit offline pattern). */
async function cacheFirstShell(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	const cached = await cache.match(request);
	if (cached) return cached;
	try {
		const response = await fetch(request);
		if (response.ok) void cache.put(request, response.clone());
		return response;
	} catch {
		return offlineResponse();
	}
}

self.addEventListener('fetch', (event) => {
	// ponytail: Vite dev URLs are not precacheable; offline QA = `npm run build && npm run preview`.
	if (DEV) return;

	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (isStaticJson(url.pathname)) {
		event.respondWith(staleWhileRevalidate(request));
		return;
	}

	if (isStaticMedia(url.pathname)) {
		event.respondWith(cacheFirst(request, MEDIA_CACHE));
		return;
	}

	if (isNavigationRequest(request)) {
		event.respondWith(navigationNetworkFirst(request));
		return;
	}

	if (isShellAsset(url.pathname)) {
		event.respondWith(cacheFirstShell(request));
		return;
	}

	event.respondWith(staleWhileRevalidate(request));
});
