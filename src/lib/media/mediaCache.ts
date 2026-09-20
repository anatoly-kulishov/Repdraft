/** Shared media URL cache via Cache API. */

export type MediaCache = {
	/** Return a usable object/data URL or the original URL. */
	getOrFetch(url: string): Promise<string>;
	clear(): Promise<void>;
};

const CACHE_NAME = 'repdraft-media-v1';

function webCache(): MediaCache {
	if (typeof caches === 'undefined') {
		return {
			async getOrFetch(url) {
				return url;
			},
			async clear() {}
		};
	}
	return {
		async getOrFetch(url: string) {
			const cache = await caches.open(CACHE_NAME);
			const hit = await cache.match(url);
			if (hit) {
				const blob = await hit.blob();
				return URL.createObjectURL(blob);
			}
			const res = await fetch(url);
			if (res.ok) {
				void cache.put(url, res.clone());
			}
			return url;
		},
		async clear() {
			await caches.delete(CACHE_NAME);
		}
	};
}

let singleton: MediaCache | null = null;

export function getMediaCache(): MediaCache {
	if (!singleton) {
		singleton = webCache();
	}
	return singleton;
}

export async function clearMediaCache(): Promise<void> {
	await getMediaCache().clear();
	singleton = null;
}
