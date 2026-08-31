import {
	isRepdraftOwnedCookieName,
	isRepdraftOwnedStorageKey
} from '$lib/domain/appStorageKeys';

function collectLocalStorageKeys(match: (key: string) => boolean): string[] {
	if (typeof localStorage === 'undefined') return [];
	const keys: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key && match(key)) keys.push(key);
	}
	return keys;
}

export function wipeRepdraftLocalStorage(): void {
	for (const key of collectLocalStorageKeys(isRepdraftOwnedStorageKey)) {
		localStorage.removeItem(key);
	}
}

export function wipeBrowserSessionStorage(): void {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.clear();
}

export function wipeRepdraftCookies(): void {
	if (typeof document === 'undefined') return;
	const names = document.cookie
		.split(';')
		.map((part) => part.split('=')[0]?.trim())
		.filter((name): name is string => Boolean(name && isRepdraftOwnedCookieName(name)));
	for (const name of names) {
		document.cookie = `${name}=; path=/; Max-Age=0; SameSite=Lax`;
	}
}

export async function wipeBrowserIndexedDatabases(): Promise<void> {
	if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return;
	try {
		const dbs = await indexedDB.databases();
		await Promise.all(
			dbs.map(
				(db) =>
					new Promise<void>((resolve, reject) => {
						if (!db.name) {
							resolve();
							return;
						}
						const req = indexedDB.deleteDatabase(db.name);
						req.onsuccess = () => resolve();
						req.onerror = () => reject(req.error);
						req.onblocked = () => resolve();
					})
			)
		);
	} catch {
		/* Safari private / older browsers */
	}
}

export async function wipeBrowserCaches(): Promise<void> {
	if (typeof caches === 'undefined') return;
	try {
		const keys = await caches.keys();
		await Promise.all(keys.map((key) => caches.delete(key)));
	} catch {
		/* private mode / older browsers */
	}
}

export async function wipeServiceWorkerRegistrations(): Promise<void> {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
	try {
		const registrations = await navigator.serviceWorker.getRegistrations();
		await Promise.all(registrations.map((registration) => registration.unregister()));
	} catch {
		/* blocked or unavailable */
	}
}

/** Full on-device wipe for QA: storage, cookies, IndexedDB, Cache API, service workers. */
export async function wipeAllAppStorage(): Promise<void> {
	wipeRepdraftLocalStorage();
	wipeBrowserSessionStorage();
	wipeRepdraftCookies();
	await wipeBrowserIndexedDatabases();
	await wipeBrowserCaches();
	await wipeServiceWorkerRegistrations();
}
