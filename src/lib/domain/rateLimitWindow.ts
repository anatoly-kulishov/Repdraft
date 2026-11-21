/**
 * In-memory sliding window for public POST routes.
 *
 * Process-local: good enough to stop casual spam on a warm node; a restart or a
 * second instance resets the counts. The feedback endpoint uses it per IP.
 */

export type RateLimitHit =
	| { ok: true; remaining: number }
	| { ok: false; retryAfterMs: number };

export type RateLimitWindow = {
	hit: (key: string, now?: number) => RateLimitHit;
	reset: () => void;
	size: () => number;
};

/** Keep the map bounded on a long-running node: sweep stale keys every N hits. */
const SWEEP_EVERY = 512;

export function createRateLimitWindow(opts: {
	limit: number;
	windowMs: number;
}): RateLimitWindow {
	const limit = Math.max(1, Math.floor(opts.limit));
	const windowMs = Math.max(1, Math.floor(opts.windowMs));
	const hits = new Map<string, number[]>();
	let calls = 0;

	const prune = (now: number) => {
		const cutoff = now - windowMs;
		for (const [key, times] of hits) {
			const alive = times.filter((t) => t > cutoff);
			if (alive.length === 0) hits.delete(key);
			else hits.set(key, alive);
		}
	};

	return {
		hit(key, now = Date.now()) {
			if (++calls % SWEEP_EVERY === 0) prune(now);
			const cutoff = now - windowMs;
			const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
			if (recent.length >= limit) {
				hits.set(key, recent);
				const oldest = recent[0] ?? now;
				return { ok: false, retryAfterMs: Math.max(1000, oldest + windowMs - now) };
			}
			recent.push(now);
			hits.set(key, recent);
			return { ok: true, remaining: limit - recent.length };
		},
		reset() {
			hits.clear();
			calls = 0;
		},
		size() {
			return hits.size;
		}
	};
}

/** Guards window math: limit, retry window and recovery after the window. */
export function runRateLimitWindowSelfCheck(): void {
	const hour = 60 * 60 * 1000;
	const limiter = createRateLimitWindow({ limit: 3, windowMs: hour });
	const t0 = 1_000_000;

	if (!limiter.hit('ip', t0).ok) throw new Error('rate limit: first hit blocked');
	limiter.hit('ip', t0 + 1);
	limiter.hit('ip', t0 + 2);
	const blocked = limiter.hit('ip', t0 + 3);
	if (blocked.ok) throw new Error('rate limit: limit not enforced');
	if (blocked.retryAfterMs > hour || blocked.retryAfterMs < 1) {
		throw new Error(`rate limit: retry ${blocked.retryAfterMs}`);
	}
	if (!limiter.hit('other', t0 + 4).ok) throw new Error('rate limit: keys leaked');

	const afterWindow = limiter.hit('ip', t0 + hour + 1);
	if (!afterWindow.ok) throw new Error('rate limit: window never resets');

	limiter.reset();
	if (limiter.size() !== 0) throw new Error('rate limit: reset left keys');
}
