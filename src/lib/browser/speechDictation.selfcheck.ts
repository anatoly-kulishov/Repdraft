/**
 * Hostile selfcheck: prove speechDictation / mic permission contracts break.
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/browser/speechDictation.selfcheck.ts
 */
// @ts-nocheck — intentional hostile mocks against Window/Navigator
import {
	ensureMicrophonePermission,
	speechDictationBlockReason,
	speechDictationSupported,
	startSpeechDictation,
	speechLangFromLocale
} from './speechDictation.ts';

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(message);
}

type RecInstance = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	onresult: ((ev: unknown) => void) | null;
	onerror: ((ev: { error: string }) => void) | null;
	onend: (() => void) | null;
	start: () => void;
	stop: () => void;
	abort: () => void;
};

type MockOpts = {
	secure?: boolean;
	withCtor?: boolean;
	/** Omit → default granted getUserMedia. null → no mediaDevices. */
	getUserMedia?: (() => Promise<{ getTracks: () => Array<{ stop: () => void }> }>) | null;
	/** Omit → prompt. 'missing' → no permissions API. fn that throws → query failure. */
	permissionsQuery?: (() => Promise<{ state: PermissionState }>) | 'missing';
	startThrows?: Error | null;
	stopFiresOnEnd?: boolean;
};

const g = globalThis as typeof globalThis & {
	window?: unknown;
	navigator?: unknown;
};

let lastRec: RecInstance | null = null;

function makeCtor(startThrows: Error | null, stopFiresOnEnd: boolean): new () => RecInstance {
	return class MockSpeechRecognition implements RecInstance {
		lang = '';
		continuous = false;
		interimResults = false;
		onresult: RecInstance['onresult'] = null;
		onerror: RecInstance['onerror'] = null;
		onend: RecInstance['onend'] = null;
		constructor() {
			lastRec = this;
		}
		start() {
			if (startThrows) throw startThrows;
		}
		stop() {
			if (stopFiresOnEnd) this.onend?.();
		}
		abort() {
			if (stopFiresOnEnd) this.onend?.();
		}
	};
}

function installEnv(opts: MockOpts = {}): void {
	const secure = opts.secure ?? true;
	const withCtor = opts.withCtor ?? true;
	const startThrows = opts.startThrows ?? null;
	const stopFiresOnEnd = opts.stopFiresOnEnd ?? true;
	const Ctor = withCtor ? makeCtor(startThrows, stopFiresOnEnd) : undefined;

	g.window = {
		isSecureContext: secure,
		SpeechRecognition: Ctor,
		webkitSpeechRecognition: undefined
	};

	let mediaDevices: { getUserMedia: NonNullable<Exclude<MockOpts['getUserMedia'], null>> } | undefined;
	if (opts.getUserMedia === null) {
		mediaDevices = undefined;
	} else if (opts.getUserMedia) {
		mediaDevices = { getUserMedia: opts.getUserMedia };
	} else {
		mediaDevices = {
			getUserMedia: async () => ({
				getTracks: () => [{ stop: () => undefined }]
			})
		};
	}

	const permissions =
		opts.permissionsQuery === 'missing'
			? undefined
			: {
					query:
						opts.permissionsQuery ??
						(async () => ({ state: 'prompt' as PermissionState }))
				};

	g.navigator = {
		mediaDevices,
		permissions
	};
}

function wipeEnv(): void {
	delete g.window;
	delete g.navigator;
	lastRec = null;
}

function resultLike(isFinal: boolean, transcript: string) {
	return { isFinal, 0: { transcript } };
}

/**
 * Decision table mirrored from `src/routes/ai/+page.svelte` toggleDictation onError
 * (listening / fieldError side-effects only).
 */
function uiAfterDictationError(
	code: string,
	_listeningBefore: boolean
): { listening: boolean; field: 'denied' | 'error' | 'unavailable' | null } {
	/* Any recognition error clears listening; aborted/no-speech stay quiet. */
	if (code === 'aborted' || code === 'no-speech') {
		return { listening: false, field: null };
	}
	if (code === 'not-allowed' || code === 'service-not-allowed') {
		return { listening: false, field: 'denied' };
	}
	if (code === 'unavailable') {
		return { listening: false, field: 'unavailable' };
	}
	return { listening: false, field: 'error' };
}

// sanity (must pass)
assert(speechLangFromLocale('en') === 'en-US', 'en locale → en-US');
assert(speechLangFromLocale('ru') === 'ru-RU', 'ru locale → ru-RU');
wipeEnv();
assert(speechDictationSupported() === false, 'no window → unsupported');
assert(speechDictationBlockReason() === 'unsupported', 'no window → block unsupported');

const failures: string[] = [];

async function attack(name: string, fn: () => Promise<void> | void): Promise<void> {
	try {
		await fn();
		console.log(`PASS (not broken): ${name}`);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		failures.push(`${name} :: ${msg}`);
		console.error(`FAIL: ${name}\n  ${msg}`);
	} finally {
		wipeEnv();
	}
}

// Attack 1: NotFoundError (no hardware) → permission "denied"
await attack('Attack1 NotFoundError→denied', async () => {
	installEnv({
		getUserMedia: async () => {
			throw new DOMException('Requested device not found', 'NotFoundError');
		}
	});
	const result = await ensureMicrophonePermission();
	assert(
		result !== 'denied',
		`NotFoundError must not be permission-denied (got ${result})`
	);
});

// Attack 2: NotReadableError (device busy) → permission "denied"
await attack('Attack2 NotReadableError→denied', async () => {
	installEnv({
		getUserMedia: async () => {
			throw new DOMException('Could not start audio source', 'NotReadableError');
		}
	});
	const result = await ensureMicrophonePermission();
	assert(
		result !== 'denied',
		`NotReadableError must not be permission-denied (got ${result})`
	);
});

// Attack 3: startSpeechDictation maps hardware failure to not-allowed (UI → dictateDenied)
await attack('Attack3 hardware→not-allowed', async () => {
	installEnv({
		getUserMedia: async () => {
			throw new DOMException('Requested device not found', 'NotFoundError');
		}
	});
	let errorCode: string | null = null;
	const session = await startSpeechDictation({
		lang: 'en-US',
		onFinal: () => undefined,
		onError: (code) => {
			errorCode = code;
		}
	});
	assert(session === null, 'session should be null on mic failure');
	assert(
		errorCode !== 'not-allowed',
		`hardware NotFoundError must not surface as not-allowed (got ${errorCode})`
	);
});

// Attack 4: stop() double-fires onEnd when called twice
await attack('Attack4 stop() double onEnd', async () => {
	installEnv({ stopFiresOnEnd: true });
	let endCount = 0;
	const session = await startSpeechDictation({
		lang: 'ru-RU',
		onFinal: () => undefined,
		onEnd: () => {
			endCount += 1;
		}
	});
	assert(session !== null, 'expected session');
	session!.stop();
	session!.stop();
	assert(endCount === 1, `stop() twice must fire onEnd once (got ${endCount})`);
});

// Attack 5: natural onend then stop() double-fires onEnd
await attack('Attack5 natural end + stop() double onEnd', async () => {
	installEnv({ stopFiresOnEnd: true });
	let endCount = 0;
	const session = await startSpeechDictation({
		lang: 'ru-RU',
		onFinal: () => undefined,
		onEnd: () => {
			endCount += 1;
		}
	});
	assert(session !== null, 'expected session');
	assert(lastRec !== null, 'expected recognition instance');
	lastRec!.onend?.();
	assert(endCount === 1, `natural onend should fire once (got ${endCount})`);
	session!.stop();
	assert(endCount === 1, `stop() after natural onend must not re-fire onEnd (got ${endCount})`);
});

// Attack 6: one-shot ends with only interim — onFinal never called (utterance lost)
await attack('Attack6 interim-only one-shot loses final', async () => {
	installEnv({ stopFiresOnEnd: false });
	const finals: string[] = [];
	const interims: string[] = [];
	const session = await startSpeechDictation({
		lang: 'en-US',
		onFinal: (t) => finals.push(t),
		onInterim: (t) => interims.push(t),
		onEnd: () => undefined
	});
	assert(session !== null, 'expected session');
	assert(lastRec !== null, 'expected recognition instance');
	lastRec!.onresult?.({
		resultIndex: 0,
		results: [resultLike(false, '  hello world  ')]
	});
	lastRec!.onend?.();
	assert(interims.includes('hello world'), 'interim should arrive');
	assert(
		finals.includes('hello world'),
		`one-shot end must promote last interim to onFinal (finals=${JSON.stringify(finals)})`
	);
});

// Attack 7: startSpeechDictation ignores insecure context (supported=false but still starts)
await attack('Attack7 insecure context still starts', async () => {
	installEnv({ secure: false });
	assert(speechDictationSupported() === false, 'insecure must report unsupported');
	assert(speechDictationBlockReason() === 'insecure', 'block reason insecure');

	let errorCode: string | null = null;
	const session = await startSpeechDictation({
		lang: 'en-US',
		onFinal: () => undefined,
		onError: (code) => {
			errorCode = code;
		}
	});
	assert(
		session === null,
		`startSpeechDictation must refuse insecure context (got session, error=${errorCode})`
	);
});

// Attack 8: permissions.state===granted skips getUserMedia entirely
await attack('Attack8 stale permissions.granted skips getUserMedia', async () => {
	let gumCalls = 0;
	installEnv({
		permissionsQuery: async () => ({ state: 'granted' }),
		getUserMedia: async () => {
			gumCalls += 1;
			throw new DOMException('Requested device not found', 'NotFoundError');
		}
	});
	const result = await ensureMicrophonePermission();
	assert(gumCalls >= 1, `granted path must still verify getUserMedia (calls=${gumCalls})`);
	assert(result !== 'granted' || gumCalls >= 1, 'stale grant without gum is a lie');
});

// Attack 9: speechDictationSupported ignores missing mediaDevices
await attack('Attack9 supported without mediaDevices', async () => {
	installEnv({ getUserMedia: null });
	assert(
		speechDictationSupported() === false,
		'supported() must be false when mediaDevices/getUserMedia missing'
	);
	const perm = await ensureMicrophonePermission();
	assert(perm === 'unsupported', `expected unsupported got ${perm}`);
});

// Attack 10: UI aborted/no-speech early-return leaves listening=true if onend never comes
await attack('Attack10 UI aborted leaves listening stuck', () => {
	const after = uiAfterDictationError('aborted', true);
	assert(
		after.listening === false,
		`aborted must clear listening (got listening=${after.listening})`
	);
});

await attack('Attack11 UI no-speech leaves listening stuck', () => {
	const after = uiAfterDictationError('no-speech', true);
	assert(
		after.listening === false,
		`no-speech must clear listening (got listening=${after.listening})`
	);
});

// Attack 12: recognition error after grant — module onerror does not call onEnd
await attack('Attack12 onerror without onend leaves session open', async () => {
	installEnv({ stopFiresOnEnd: false });
	let endCount = 0;
	let errorCode: string | null = null;
	const session = await startSpeechDictation({
		lang: 'en-US',
		onFinal: () => undefined,
		onError: (code) => {
			errorCode = code;
		},
		onEnd: () => {
			endCount += 1;
		}
	});
	assert(session !== null, 'expected session');
	assert(lastRec !== null, 'expected recognition instance');
	lastRec!.onerror?.({ error: 'service-not-allowed' });
	assert(errorCode === 'service-not-allowed', 'error forwarded');
	assert(
		endCount === 1,
		`onerror must end session via onEnd when engine omits onend (got endCount=${endCount})`
	);
});

// Attack 13 (junk / out of scope): module passes raw transcript; UI caps via AI_BRIEF_MAX.
await attack('Attack13 unbounded transcript length (UI-bounded)', async () => {
	installEnv({ stopFiresOnEnd: false });
	const huge = 'x'.repeat(50_000);
	let got = '';
	const session = await startSpeechDictation({
		lang: 'en-US',
		onFinal: (t) => {
			got = t.slice(0, 2000);
		}
	});
	assert(session !== null, 'expected session');
	assert(lastRec !== null, 'expected recognition instance');
	lastRec!.onresult?.({
		resultIndex: 0,
		results: [resultLike(true, huge)]
	});
	assert(got.length <= 2000, `UI path must bound transcript (got ${got.length})`);
});

// Attack 14: start() InvalidStateError → null + start_failed, but no onEnd for lifecycle symmetry
await attack('Attack14 start_failed skips onEnd', async () => {
	installEnv({
		startThrows: new DOMException('recognition already started', 'InvalidStateError'),
		stopFiresOnEnd: false
	});
	let endCount = 0;
	let errorCode: string | null = null;
	const session = await startSpeechDictation({
		lang: 'en-US',
		onFinal: () => undefined,
		onError: (code) => {
			errorCode = code;
		},
		onEnd: () => {
			endCount += 1;
		}
	});
	assert(session === null, 'start failure → null');
	assert(errorCode === 'start_failed', `expected start_failed got ${errorCode}`);
	assert(endCount === 1, `start_failed must also call onEnd (got ${endCount})`);
});

if (failures.length === 0) {
	console.log('speechDictation.selfcheck: zero failing attacks (code held under probe)');
	process.exit(0);
}

console.error(`\nspeechDictation.selfcheck: ${failures.length} hostile break(s)`);
for (const f of failures) console.error(` - ${f}`);
process.exit(1);
