/**
 * Phase 2 preview store: coach mode on this device only.
 * No backend yet — links and demo clients live in localStorage so the product
 * can be evaluated before the Supabase schema is applied.
 */
import { browser } from '$app/environment';
import {
	INVITE_CODE_ALPHABET,
	INVITE_CODE_LENGTH,
	acceptLink,
	createPendingLink,
	revokeLink,
	summarizeClientSessions,
	type CoachClientLink,
	type CoachSessionSummary
} from '$lib/domain/coach';
import type { WorkoutSession } from '$lib/domain/types';
import { get, writable } from 'svelte/store';

export const COACH_STORAGE_KEY = 'repdraft:coach-preview';
const LOCAL_COACH_ID = 'local-coach';
const DEMO_NAMES = ['Анна К.', 'Дмитрий П.', 'Марина С.', 'Илья В.', 'Ольга Т.'];
const DAY_MS = 86_400_000;

export type DemoClient = {
	link: CoachClientLink;
	displayName: string;
	/** Session history is generated once and stored, so numbers stay stable. */
	sessions: WorkoutSession[];
};

type CoachState = {
	version: 1;
	inviteCode: string | null;
	clients: DemoClient[];
};

function emptyState(): CoachState {
	return { version: 1, inviteCode: null, clients: [] };
}

function readState(): CoachState {
	if (!browser) return emptyState();
	try {
		const raw = localStorage.getItem(COACH_STORAGE_KEY);
		if (!raw) return emptyState();
		const parsed = JSON.parse(raw) as CoachState;
		if (parsed?.version !== 1 || !Array.isArray(parsed.clients)) return emptyState();
		return parsed;
	} catch {
		return emptyState();
	}
}

function writeState(state: CoachState) {
	if (!browser) return;
	try {
		localStorage.setItem(COACH_STORAGE_KEY, JSON.stringify(state));
	} catch {
		/* quota — drop silently, this is a preview surface */
	}
}

/** Crockford-style code: 8 chars, no I/L/O/U. */
export function generateInviteCode(random: () => number = Math.random): string {
	let code = '';
	for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
		code += INVITE_CODE_ALPHABET[Math.floor(random() * INVITE_CODE_ALPHABET.length)] ?? '0';
	}
	return code;
}

function demoSession(index: number, now: Date): WorkoutSession {
	const daysAgo = index * 2 + 1;
	const started = new Date(now.getTime() - daysAgo * DAY_MS);
	const finished = new Date(started.getTime() + 55 * 60_000);
	const weight = 40 + index * 5;
	return {
		id: `demo-session-${index}`,
		planId: null,
		planName: index % 2 === 0 ? 'Push' : 'Pull',
		startedAt: started.toISOString(),
		finishedAt: finished.toISOString(),
		exercises: [
			{
				exerciseId: '0025',
				targetSets: 3,
				targetReps: 8,
				restSec: 90,
				sets: [
					{ weightKg: weight, reps: 8, completed: true },
					{ weightKg: weight, reps: 8, completed: true },
					{ weightKg: weight, reps: 6, completed: index % 3 !== 0 }
				]
			}
		]
	};
}

const store = writable<CoachState>(readState());

if (browser) store.subscribe((state) => writeState(state));

export const coachPreviewState = { subscribe: store.subscribe };

export const coachPreview = {
	/** Creates (or returns) the local invite code shown to a client. */
	createInvite(now: Date = new Date()): string {
		const existing = get(store).inviteCode;
		if (existing) return existing;
		const code = generateInviteCode();
		store.update((state) => ({ ...state, inviteCode: code }));
		return code;
	},
	refreshInvite(): string {
		const code = generateInviteCode();
		store.update((state) => ({ ...state, inviteCode: code }));
		return code;
	},
	addDemoClient(now: Date = new Date()): DemoClient {
		const state = get(store);
		const index = state.clients.length;
		const clientUserId = `demo-client-${index + 1}`;
		const link = acceptLink(
			createPendingLink({
				id: `demo-link-${index + 1}`,
				coachUserId: LOCAL_COACH_ID,
				clientUserId,
				now
			}),
			now
		);
		const sessions = Array.from({ length: 6 }, (_, i) => demoSession(i, now));
		const client: DemoClient = {
			link,
			displayName: DEMO_NAMES[index % DEMO_NAMES.length] ?? `Клиент ${index + 1}`,
			sessions
		};
		store.update((s) => ({ ...s, clients: [...s.clients, client] }));
		return client;
	},
	revoke(clientUserId: string, now: Date = new Date()) {
		store.update((state) => ({
			...state,
			clients: state.clients.map((client) =>
				client.link.clientUserId === clientUserId
					? { ...client, link: revokeLink(client.link, now) }
					: client
			)
		}));
	},
	remove(clientUserId: string) {
		store.update((state) => ({
			...state,
			clients: state.clients.filter((c) => c.link.clientUserId !== clientUserId)
		}));
	},
	reset() {
		store.set(emptyState());
	}
};

export type CoachClientRow = {
	client: DemoClient;
	summary: CoachSessionSummary;
};

export function coachClientRows(
	clients: readonly DemoClient[],
	now: Date = new Date()
): CoachClientRow[] {
	return clients
		.filter((client) => client.link.status === 'active')
		.map((client) => ({ client, summary: summarizeClientSessions(client.sessions, now) }))
		.sort((a, b) => (b.summary.lastSessionAt ?? '').localeCompare(a.summary.lastSessionAt ?? ''));
}
