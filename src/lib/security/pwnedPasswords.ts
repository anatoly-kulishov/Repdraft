const HIBP_TIMEOUT_MS = 5_000;
const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

async function sha1HexUpper(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Have I Been Pwned k-anonymity check.
 * @returns `true` if pwned, `false` if clean, `null` if network/API unavailable.
 */
export async function isPasswordPwned(password: string): Promise<boolean | null> {
	if (!password) return null;
	let hash: string;
	try {
		hash = await sha1HexUpper(password);
	} catch {
		return null;
	}
	const prefix = hash.slice(0, 5);
	const suffix = hash.slice(5);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);
	try {
		const res = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
			headers: { 'Add-Padding': 'true' },
			signal: controller.signal
		});
		if (!res.ok) return null;
		const body = await res.text();
		const lines = body.split('\n');
		for (const line of lines) {
			const [lineSuffix] = line.trim().split(':');
			if (lineSuffix && lineSuffix.toUpperCase() === suffix) return true;
		}
		return false;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}
