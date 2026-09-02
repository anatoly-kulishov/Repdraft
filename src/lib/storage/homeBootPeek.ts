import type { HomeSkeletonVariant } from '$lib/domain/home';

/** Keep html dataset + SSR cookie in sync for `/` skeleton variant. */
export function syncHomeBootPeek(variant: HomeSkeletonVariant): void {
	if (typeof document === 'undefined') return;
	try {
		document.documentElement.dataset.homeBoot = variant;
		document.cookie = `repdraft_home_boot=${variant}; path=/; Max-Age=31536000; SameSite=Lax`;
	} catch {
		/* ignore */
	}
}

/** Signed-in peek from app.html / auth store before `$auth.ready`. */
export function peekAccountBoot(): boolean {
	if (typeof document === 'undefined') return false;
	if (document.documentElement.dataset.authBoot === 'account') return true;
	try {
		return document.cookie.includes('repdraft_auth_boot=1');
	} catch {
		return false;
	}
}
