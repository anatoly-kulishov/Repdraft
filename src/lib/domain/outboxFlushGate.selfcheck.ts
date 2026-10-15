import { shouldRetryOutboxFlush } from './outboxFlushGate.ts';

function assert(cond: boolean, msg: string) {
	if (!cond) throw new Error(msg);
}

assert(
	shouldRetryOutboxFlush({ online: true, cloudMode: true, pendingCount: 1 }) === true,
	'online + cloud + pending → retry'
);
assert(
	shouldRetryOutboxFlush({ online: false, cloudMode: true, pendingCount: 1 }) === false,
	'offline → no retry'
);
assert(
	shouldRetryOutboxFlush({ online: true, cloudMode: false, pendingCount: 1 }) === false,
	'cloud off (boot race) → no retry'
);
assert(
	shouldRetryOutboxFlush({ online: true, cloudMode: true, pendingCount: 0 }) === false,
	'empty outbox → no retry'
);

console.log('outboxFlushGate self-check ok');
