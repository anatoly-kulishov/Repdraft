/**
 * When the outbox snackbar should actively retry cloud flush.
 * iOS often restores connectivity without a reliable `online` event.
 */
export function shouldRetryOutboxFlush(input: {
	online: boolean;
	cloudMode: boolean;
	pendingCount: number;
}): boolean {
	return input.online && input.cloudMode && input.pendingCount > 0;
}
