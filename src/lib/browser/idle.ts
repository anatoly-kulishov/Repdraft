/** Run after first paint / when the main thread is idle. */
export function whenIdle(task: () => void, timeoutMs = 2500): void {
	if (typeof requestIdleCallback === 'function') {
		requestIdleCallback(() => task(), { timeout: timeoutMs });
		return;
	}
	setTimeout(task, 1);
}
