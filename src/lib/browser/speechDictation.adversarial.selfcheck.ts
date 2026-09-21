/**
 * NEW hostile probes beyond Confirmed speechDictation.selfcheck (which stays green).
 * Expect FAIL until lifecycle / taxonomy / UI race gaps are fixed.
 *
 * Run:
 *   node --import ./scripts/register-domain-selfcheck.mjs --experimental-strip-types ./src/lib/browser/speechDictation.adversarial.selfcheck.ts
 */
// @ts-nocheck — intentional hostile mocks against Window/Navigator
import {
	ensureMicrophonePermission,
	speechLangFromLocale,
	startSpeechDictation
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
	getUserMedia?: (() => Promise<{ getTracks: () => Array<{ stop: () => void }> }>) | null;
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
	/* Node may expose navigator as a getter — delete before replace (same as sibling selfcheck). */
	delete g.window;
	delete g.navigator;
	lastRec = null;

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
 * Mirrors `src/routes/ai/+page.svelte` toggleDictation listening/session wiring
 * (cancel-during-await race only).
 */
function createToggleDictationHarness(start: typeof startSpeechDictation) {
	let listening = false;
	let dictationSession: { stop: () => void } | null = null;
	let dictationGen = 0;

	function stopDictation() {
		dictationGen += 1;
		dictationSession?.stop();
		dictationSession = null;
		listening = false;
	}

	async function toggleDictation() {
		if (listening) {
			stopDictation();
			return;
		}
		const gen = ++dictationGen;
		listening = true;
		const session = await start({
			lang: 'en-US',
			onFinal: () => undefined,
			onError: () => {
				if (gen !== dictationGen) return;
				listening = false;
				dictationSession = null;
			},
			onEnd: () => {
				if (gen !== dictationGen) return;
				listening = false;
				dictationSession = null;
			}
		});
		if (gen !== dictationGen) {
			session?.stop();
			return;
		}
		if (!session) {
			listening = false;
			return;
		}
		dictationSession = session;
	}

	return {
		toggleDictation,
		get listening() {
			return listening;
		},
		get dictationSession() {
			return dictationSession;
		}
	};
}

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

// --- NEW attacks (beyond Confirmed speechDictation.selfcheck) ---

// A1: finished session still forwards onerror (stop → onerror race)
await attack('A1 stop then onerror still surfaces', async () => {
	installEnv({ stopFiresOnEnd: false });
	const errors: string[] = [];
	let endCount = 0;
	const session = await startSpeechDictation({
		lang: 'en-US',
		onFinal: () => undefined,
		onError: (code) => {
			errors.push(code);
		},
		onEnd: () => {
			endCount += 1;
		}
	});
	assert(session !== null, 'expected session');
	session!.stop();
	assert(endCount === 1, `stop must end once (got ${endCount})`);
	lastRec!.onerror?.({ error: 'network' });
	assert(
		errors.length === 0,
		`after finish, onerror must not surface to UI (got ${JSON.stringify(errors)})`
	);
});

// A2: onerror after natural onend still surfaces
await attack('A2 onerror after onend still surfaces', async () => {
	installEnv({ stopFiresOnEnd: false });
	const errors: string[] = [];
	await startSpeechDictation({
		lang: 'en-US',
		onFinal: () => undefined,
		onError: (code) => {
			errors.push(code);
		},
		onEnd: () => undefined
	});
	lastRec!.onend?.();
	lastRec!.onerror?.({ error: 'network' });
	assert(
		errors.length === 0,
		`onerror after onend must be ignored (got ${JSON.stringify(errors)})`
	);
});

// A3: onresult after stop/finish still calls onFinal
await attack('A3 onFinal after stop/finish', async () => {
	installEnv({ stopFiresOnEnd: false });
	const finals: string[] = [];
	let endCount = 0;
	const session = await startSpeechDictation({
		lang: 'en-US',
		onFinal: (t) => {
			finals.push(t);
		},
		onEnd: () => {
			endCount += 1;
		}
	});
	assert(session !== null, 'expected session');
	session!.stop();
	assert(endCount === 1, 'session finished');
	lastRec!.onresult?.({
		resultIndex: 0,
		results: [resultLike(true, 'late final')]
	});
	assert(
		finals.length === 0,
		`onFinal must not fire after finish (got ${JSON.stringify(finals)})`
	);
});

// A4: stop() without engine onend never promotes interim
await attack('A4 stop without onend loses interim', async () => {
	installEnv({ stopFiresOnEnd: false });
	const finals: string[] = [];
	const session = await startSpeechDictation({
		lang: 'en-US',
		onFinal: (t) => {
			finals.push(t);
		},
		onInterim: () => undefined,
		onEnd: () => undefined
	});
	assert(session !== null, 'expected session');
	lastRec!.onresult?.({
		resultIndex: 0,
		results: [resultLike(false, '  keep me  ')]
	});
	session!.stop();
	assert(
		finals.includes('keep me'),
		`stop must promote interim when engine omits onend (finals=${JSON.stringify(finals)})`
	);
});

// A5: one-shot emits multiple onFinal
await attack('A5 double onFinal under continuous=false', async () => {
	installEnv({ stopFiresOnEnd: false });
	const finals: string[] = [];
	await startSpeechDictation({
		lang: 'en-US',
		onFinal: (t) => {
			finals.push(t);
		}
	});
	assert(lastRec !== null && lastRec.continuous === false, 'continuous must be false');
	lastRec!.onresult?.({
		resultIndex: 0,
		results: [resultLike(true, 'one')]
	});
	lastRec!.onresult?.({
		resultIndex: 0,
		results: [resultLike(true, 'two')]
	});
	assert(
		finals.length <= 1,
		`one-shot session must emit at most one onFinal (got ${JSON.stringify(finals)})`
	);
});

// A6: SecurityError (policy / embed) mapped as user denial
await attack('A6 SecurityError taxonomy → denied', async () => {
	installEnv({
		getUserMedia: async () => {
			throw new DOMException('Permission policy blocked mic', 'SecurityError');
		}
	});
	const result = await ensureMicrophonePermission();
	assert(
		result !== 'denied',
		`SecurityError must not be user-denied (got ${result})`
	);
});

// A7: AbortError (prompt dismissed / superseded) mapped as hardware unavailable
await attack('A7 AbortError taxonomy → unavailable', async () => {
	installEnv({
		getUserMedia: async () => {
			throw new DOMException('The user aborted a request', 'AbortError');
		}
	});
	const result = await ensureMicrophonePermission();
	assert(
		result !== 'unavailable',
		`AbortError must not be hardware-unavailable (got ${result})`
	);
});

// A8: UI cancel during ensureMicrophonePermission adopts orphan session
await attack('A8 UI cancel-during-await orphans session', async () => {
	let releaseGum: (() => void) | null = null;
	const gumGate = new Promise<void>((resolve) => {
		releaseGum = resolve;
	});
	installEnv({
		stopFiresOnEnd: false,
		getUserMedia: async () => {
			await gumGate;
			return { getTracks: () => [{ stop: () => undefined }] };
		}
	});

	const ui = createToggleDictationHarness(startSpeechDictation);
	const startPromise = ui.toggleDictation();
	assert(ui.listening === true, 'listening while awaiting permission');
	await ui.toggleDictation();
	assert(ui.listening === false, 'cancel must clear listening');
	assert(ui.dictationSession === null, 'no session yet during await');
	releaseGum!();
	await startPromise;
	assert(
		ui.dictationSession === null,
		`cancel during await must not adopt live session (orphan=${ui.dictationSession != null}, listening=${ui.listening})`
	);
});

// A9: unknown AppLocale silently becomes ru-RU
await attack('A9 speechLangFromLocale unknown → ru-RU', () => {
	const lang = speechLangFromLocale('de');
	assert(
		lang === 'en-US' || lang.startsWith('de'),
		`unknown locale must not silently map to ru-RU (got ${lang})`
	);
});

// A10: empty lang accepted (no refuse / default)
await attack('A10 empty lang accepted', async () => {
	installEnv({ stopFiresOnEnd: false });
	const session = await startSpeechDictation({
		lang: '',
		onFinal: () => undefined,
		onError: () => undefined
	});
	assert(session === null, `empty lang must be refused (rec.lang=${JSON.stringify(lastRec?.lang)})`);
});

// Control: empty/whitespace interim must NOT promote (should PASS — not a break)
await attack('CTRL empty interim does not promote', async () => {
	installEnv({ stopFiresOnEnd: false });
	const finals: string[] = [];
	await startSpeechDictation({
		lang: 'en-US',
		onFinal: (t) => {
			finals.push(t);
		},
		onInterim: () => undefined
	});
	lastRec!.onresult?.({
		resultIndex: 0,
		results: [resultLike(false, '   ')]
	});
	lastRec!.onend?.();
	assert(
		!finals.some((f) => f.trim() === ''),
		`must not onFinal empty (finals=${JSON.stringify(finals)})`
	);
});

if (failures.length === 0) {
	console.log('speechDictation.adversarial.selfcheck: zero NEW breaks');
	process.exit(0);
}

console.error(`\nspeechDictation.adversarial.selfcheck: ${failures.length} NEW break(s)`);
for (const f of failures) console.error(` - ${f}`);
process.exit(1);
