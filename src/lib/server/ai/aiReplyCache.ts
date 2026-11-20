/**
 * Small in-process reply cache with single-flight, for the capped AI text routes.
 *
 * The daily quota is tiny (10 calls) and is spent *before* the model runs, so the
 * same request must never cost a second call: a double tap that slips past the
 * client latch, a retry after a dropped response, a reopened sheet, or a second
 * tab all resolve to the same key and share one provider call.
 *
 * In-memory like the quota itself: warm-process scope, not a global ledger. A cold
 * process simply calls the model again.
 */

type Entry<T> = {
	at: number;
	call: Promise<T>;
};

export type AiReplyCache<T> = {
	/** Cached reply or an in-flight call to await; `undefined` when absent. */
	get(key: string): Promise<T> | undefined;
	/** Registers an in-flight call under `key` (single-flight). */
	track(key: string, call: Promise<T>): Promise<T>;
	/** Forget a call that produced no usable answer (errors must not be cached). */
	drop(key: string): void;
	clear(): void;
	size(): number;
};

export function createAiReplyCache<T>(
	options: { ttlMs?: number; max?: number } = {}
): AiReplyCache<T> {
	const ttlMs = options.ttlMs ?? 10 * 60_000;
	const max = options.max ?? 128;
	const entries = new Map<string, Entry<T>>();

	function prune(now: number) {
		for (const [key, entry] of entries) {
			if (now - entry.at > ttlMs) entries.delete(key);
		}
		/* Map keeps insertion order, so the first key is the oldest. */
		while (entries.size >= max) {
			const oldest = entries.keys().next().value;
			if (oldest === undefined) break;
			entries.delete(oldest);
		}
	}

	return {
		get(key) {
			const hit = entries.get(key);
			if (!hit) return undefined;
			if (Date.now() - hit.at > ttlMs) {
				entries.delete(key);
				return undefined;
			}
			return hit.call;
		},
		track(key, call) {
			prune(Date.now());
			entries.set(key, { at: Date.now(), call });
			return call;
		},
		drop(key) {
			entries.delete(key);
		},
		clear() {
			entries.clear();
		},
		size() {
			return entries.size;
		}
	};
}
