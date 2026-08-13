const GREETING_NAME_PREFIX = 'repdraft:greeting-name:';

export function greetingNameStorageKey(userId: string): string {
	return `${GREETING_NAME_PREFIX}${userId}`;
}

export function readGreetingName(userId: string): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(greetingNameStorageKey(userId));
		if (raw === null) return null;
		return raw;
	} catch {
		return null;
	}
}

export function writeGreetingName(userId: string, name: string | null): void {
	if (typeof localStorage === 'undefined') return;
	try {
		const key = greetingNameStorageKey(userId);
		if (!name) localStorage.removeItem(key);
		else localStorage.setItem(key, name);
	} catch {
		/* ignore */
	}
}
