/** Shared media URL cache: web Cache API, native Capacitor Filesystem LRU. */
import { Directory, Filesystem } from '@capacitor/filesystem';
import { isNativeApp } from '$lib/app/native';

export type MediaCache = {
	/** Return a usable object/data URL or the original URL. */
	getOrFetch(url: string): Promise<string>;
	clear(): Promise<void>;
};

const MAX_NATIVE_ENTRIES = 40;
const CACHE_NAME = 'repdraft-media-v1';
const DIR = 'media-cache';
const INDEX_KEY = 'repdraft.mediaCacheIndex';

type IndexEntry = { key: string; at: number };

function hashKey(url: string): string {
	let h = 2166136261;
	for (let i = 0; i < url.length; i++) {
		h ^= url.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return `m_${(h >>> 0).toString(16)}`;
}

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

function readIndex(): IndexEntry[] {
	try {
		const raw = localStorage.getItem(INDEX_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as IndexEntry[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeIndex(entries: IndexEntry[]) {
	try {
		localStorage.setItem(INDEX_KEY, JSON.stringify(entries.slice(0, MAX_NATIVE_ENTRIES)));
	} catch {
		/* ignore */
	}
}

async function ensureDir() {
	try {
		await Filesystem.mkdir({ path: DIR, directory: Directory.Cache, recursive: true });
	} catch {
		/* exists */
	}
}

async function evict(entries: IndexEntry[]) {
	while (entries.length > MAX_NATIVE_ENTRIES) {
		const oldest = entries.pop();
		if (!oldest) break;
		try {
			await Filesystem.deleteFile({
				path: `${DIR}/${oldest.key}`,
				directory: Directory.Cache
			});
		} catch {
			/* ignore */
		}
	}
}

function nativeCache(): MediaCache {
	void ensureDir();
	return {
		async getOrFetch(url: string) {
			const key = hashKey(url);
			let entries = readIndex().sort((a, b) => b.at - a.at);
			const existing = entries.find((e) => e.key === key);
			if (existing) {
				existing.at = Date.now();
				writeIndex(entries);
				try {
					const { data } = await Filesystem.readFile({
						path: `${DIR}/${key}`,
						directory: Directory.Cache
					});
					if (typeof data === 'string' && data.startsWith('data:')) return data;
					if (typeof data === 'string') {
						return `data:application/octet-stream;base64,${data}`;
					}
				} catch {
					entries = entries.filter((e) => e.key !== key);
					writeIndex(entries);
				}
			}

			const res = await fetch(url);
			if (!res.ok) return url;
			const buf = await res.arrayBuffer();
			const bytes = new Uint8Array(buf);
			let binary = '';
			const chunk = 0x8000;
			for (let i = 0; i < bytes.length; i += chunk) {
				binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
			}
			const base64 = btoa(binary);
			const mime = res.headers.get('content-type') || 'application/octet-stream';
			try {
				await Filesystem.writeFile({
					path: `${DIR}/${key}`,
					directory: Directory.Cache,
					data: base64
				});
				entries = [{ key, at: Date.now() }, ...entries.filter((e) => e.key !== key)];
				await evict(entries);
				writeIndex(entries);
			} catch {
				/* disk full — still return network URL */
			}
			return `data:${mime};base64,${base64}`;
		},
		async clear() {
			const entries = readIndex();
			for (const entry of entries) {
				try {
					await Filesystem.deleteFile({
						path: `${DIR}/${entry.key}`,
						directory: Directory.Cache
					});
				} catch {
					/* ignore */
				}
			}
			writeIndex([]);
		}
	};
}

let singleton: MediaCache | null = null;

export function getMediaCache(): MediaCache {
	if (!singleton) {
		singleton = isNativeApp() ? nativeCache() : webCache();
	}
	return singleton;
}

export async function clearMediaCache(): Promise<void> {
	await getMediaCache().clear();
	singleton = null;
}
