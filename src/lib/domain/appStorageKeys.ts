/** Keys owned by Repdraft in localStorage (incl. Supabase auth mirror). */
export function isRepdraftOwnedStorageKey(key: string): boolean {
	if (key.startsWith('repdraft')) return true;
	return key.startsWith('sb-') && key.includes('auth');
}

/** Cookie names cleared by dev wipe (SSR boot mirrors + Supabase). */
export function isRepdraftOwnedCookieName(name: string): boolean {
	if (name.startsWith('repdraft')) return true;
	return name.startsWith('sb-');
}
