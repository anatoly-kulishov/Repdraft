/** Safe internal return paths for `?from=` (no open redirect). */
export function isSafeFromPath(from: string | null | undefined): boolean {
	if (!from?.startsWith('/')) return false;
	if (from.startsWith('//')) return false;
	if (from.includes('://')) return false;
	return true;
}

/** Append `?from=` / `&from=` so subroutes keep a return path. */
export function withFromParam(href: string, from: string | null | undefined): string {
	const value = from?.trim();
	if (!value || !isSafeFromPath(value)) return href;
	const sep = href.includes('?') ? '&' : '?';
	return `${href}${sep}from=${encodeURIComponent(value)}`;
}

export function currentReturnPath(
	pathname: string,
	searchParams: URLSearchParams | string
): string {
	const qs =
		typeof searchParams === 'string' ? searchParams : searchParams.toString();
	return qs ? `${pathname}?${qs}` : pathname;
}

export function linkWithFrom(targetPath: string, returnPath: string): string {
	return withFromParam(targetPath, returnPath);
}

/** Resolve `?from=` for subroute back links; legacy aliases map to hub paths. */
export function resolveBackFrom(from: string | null | undefined, fallback = '/exercises'): string {
	const raw = from?.trim();
	if (!raw) return fallback;
	if (isSafeFromPath(raw)) return raw;
	if (raw === 'workouts' || raw.startsWith('/workouts')) {
		return raw.startsWith('/') ? raw : '/workouts';
	}
	if (raw === 'catalog' || raw === 'exercises') return '/exercises';
	return fallback;
}

export function runNavigationSelfCheck(): void {
	if (!isSafeFromPath('/exercises/records')) throw new Error('isSafeFromPath /exercises/records');
	if (!isSafeFromPath('/records')) throw new Error('isSafeFromPath /records legacy');
	if (isSafeFromPath('//evil.com')) throw new Error('isSafeFromPath reject protocol-relative');
	if (isSafeFromPath('https://evil.com')) throw new Error('isSafeFromPath reject absolute URL');

	if (
		withFromParam('/exercise/1', '/exercises/records') !==
		'/exercise/1?from=%2Fexercises%2Frecords'
	) {
		throw new Error('withFromParam append exercises/records');
	}
	if (withFromParam('/catalog/all?q=press', '/builder') !== '/catalog/all?q=press&from=%2Fbuilder') {
		throw new Error('withFromParam existing query');
	}
	if (withFromParam('/exercise/1', '//x') !== '/exercise/1') {
		throw new Error('withFromParam reject unsafe from');
	}

	if (resolveBackFrom('/exercises/records') !== '/exercises/records') {
		throw new Error('resolveBackFrom exercises/records path');
	}
	if (resolveBackFrom('/records') !== '/records') throw new Error('resolveBackFrom legacy records path');
	if (resolveBackFrom('workouts') !== '/workouts') throw new Error('resolveBackFrom workouts alias');
	if (resolveBackFrom('catalog') !== '/exercises') throw new Error('resolveBackFrom catalog alias');
	if (resolveBackFrom(null, '/articles') !== '/articles') throw new Error('resolveBackFrom fallback');

	if (
		currentReturnPath('/catalog/chest', new URLSearchParams('from=%2Fexercises%2Frecords')) !==
		'/catalog/chest?from=%2Fexercises%2Frecords'
	) {
		throw new Error('currentReturnPath search');
	}
	if (linkWithFrom('/articles/a', '/exercise/1') !== '/articles/a?from=%2Fexercise%2F1') {
		throw new Error('linkWithFrom');
	}
}
