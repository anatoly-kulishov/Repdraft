/**
 * Phase 2: coach ↔ client contract (pure domain).
 *
 * Deliberately tiny: a link between two accounts, an invite code to create it,
 * and read-only rollups the coach sees. No payments, no chat, no program
 * marketplace — the sacred loop must not get slower.
 */
import type { LoggedSet, SessionExercise, SetKind, WorkoutExercise, WorkoutSession } from './types';

export const INVITE_CODE_LENGTH = 8;
/** Crockford-ish alphabet: no I/L/O/U to survive handwriting, QR and phone read-out. */
export const INVITE_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const MAX_ACTIVE_CLIENTS = 50;

export type CoachLinkStatus = 'pending' | 'active' | 'revoked';

export type CoachClientLink = {
	id: string;
	coachUserId: string;
	clientUserId: string;
	status: CoachLinkStatus;
	createdAt: string;
	updatedAt: string;
	/**
	 * Client label in the coach's list. On accept the DB fills it with the client's
	 * display name; the coach can rename it later. Never rendered on the client side.
	 */
	note?: string;
};

export type CoachSessionSummary = {
	sessions: number;
	sets: number;
	volumeKg: number;
	lastSessionAt: string | null;
	/** Sessions in the last 7 days, counted from `now`. */
	sessions7d: number;
	/** True when a finished session happened in the last 48 hours. */
	activeRecently: boolean;
	/** Id of the newest finished session (for coach open-detail). */
	lastSessionId?: string | null;
	/** Plan name of that session. */
	lastPlanName?: string | null;
};

/** One finished session the coach may open (RPC, not direct table read). */
export type CoachSessionDetail = {
	id: string;
	clientUserId: string;
	planName: string;
	startedAt: string;
	finishedAt: string;
	exercises: WorkoutSession['exercises'];
};

/** Active coach link as seen by the client (with display name). */
export type CoachMyCoach = {
	linkId: string;
	coachUserId: string;
	coachName: string | null;
	createdAt: string;
	updatedAt: string;
};

/** One of the coach's own plans offered in the assign picker. */
export type CoachAssignablePlan = {
	planId: string;
	name: string;
	exerciseCount: number;
};

/**
 * Plan a coach pinned for the client. A snapshot (not a live reference): the
 * client imports it as their own plan, so later edits on either side do not
 * leak into the other account.
 */
export type CoachAssignment = {
	assignmentId: string;
	coachUserId: string;
	coachName: string | null;
	planName: string;
	exercises: WorkoutExercise[];
	assignedAt: string;
};

function isSetKind(value: unknown): value is SetKind {
	return value === 'work' || value === 'warmup' || value === 'drop' || value === 'failure';
}

function numField(value: unknown): number {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function parseLoggedSet(raw: unknown): LoggedSet | null {
	if (!raw || typeof raw !== 'object') return null;
	const row = raw as Record<string, unknown>;
	const weight =
		typeof row.weightKg === 'number'
			? row.weightKg
			: typeof row.weightKg === 'string'
				? Number(row.weightKg)
				: null;
	const reps =
		typeof row.reps === 'number'
			? row.reps
			: typeof row.reps === 'string'
				? Number(row.reps)
				: null;
	return {
		weightKg: weight != null && Number.isFinite(weight) ? weight : null,
		reps: reps != null && Number.isFinite(reps) ? reps : null,
		completed: row.completed === true,
		...(isSetKind(row.kind) ? { kind: row.kind } : {})
	};
}

/** Totals the coach can show for one read-only session (no WorkoutSession shell). */
export function coachSessionTotals(detail: {
	startedAt: string;
	finishedAt: string;
	exercises: WorkoutSession['exercises'];
}): { minutes: number | null; sets: number; volumeKg: number } {
	let sets = 0;
	let volumeKg = 0;
	for (const exercise of detail.exercises) {
		if (exercise.skipped) continue;
		for (const set of exercise.sets) {
			if (!set.completed) continue;
			sets += 1;
			if (set.weightKg != null && set.reps != null && set.weightKg > 0 && set.reps > 0) {
				volumeKg += set.weightKg * set.reps;
			}
		}
	}
	const ms = Date.parse(detail.finishedAt) - Date.parse(detail.startedAt);
	const minutes = Number.isFinite(ms) && ms >= 60_000 ? Math.round(ms / 60_000) : null;
	return { minutes, sets, volumeKg: Math.round(volumeKg) };
}

/** Two-letter initials for the compact client list avatar (no photo in link data). */
export function clientInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
	if (parts.length === 0) return '?';
	return parts
		.map((part) => Array.from(part)[0]?.toUpperCase() ?? '')
		.join('');
}

/** Parse session.exercises jsonb from coach RPCs into domain shapes. */
export function parseCoachSessionExercises(raw: unknown): SessionExercise[] {
	if (!Array.isArray(raw)) return [];
	const out: SessionExercise[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const exerciseId = typeof row.exerciseId === 'string' ? row.exerciseId : '';
		if (!exerciseId) continue;
		const setsRaw = Array.isArray(row.sets) ? row.sets : [];
		const sets = setsRaw
			.map(parseLoggedSet)
			.filter((set): set is LoggedSet => set != null);
		out.push({
			exerciseId,
			targetSets: numField(row.targetSets),
			targetReps: numField(row.targetReps),
			restSec: numField(row.restSec),
			sets,
			...(typeof row.groupId === 'string' || row.groupId === null
				? { groupId: row.groupId as string | null }
				: {}),
			...(typeof row.altGroupId === 'string' || row.altGroupId === null
				? { altGroupId: row.altGroupId as string | null }
				: {}),
			...(row.skipped === true ? { skipped: true } : {}),
			...(typeof row.note === 'string' ? { note: row.note } : {})
		});
	}
	return out;
}

/**
 * Plan snapshot (`WorkoutExercise[]`) stored in a coach assignment.
 * Defensive: the coach's plan travels as JSON, so unknown fields are dropped
 * and every number is clamped before it reaches the live session.
 */
export function parseCoachPlanExercises(raw: unknown): WorkoutExercise[] {
	if (!Array.isArray(raw)) return [];
	const out: WorkoutExercise[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const exerciseId = typeof row.exerciseId === 'string' ? row.exerciseId.trim() : '';
		if (!exerciseId) continue;
		const exercise: WorkoutExercise = {
			exerciseId,
			sets: Math.max(0, Math.round(numField(row.sets))),
			reps: Math.max(0, Math.round(numField(row.reps))),
			restSec: Math.max(0, Math.round(numField(row.restSec)))
		};
		if (Array.isArray(row.repsScheme)) {
			const scheme = row.repsScheme
				.map((value) => Math.max(0, Math.round(numField(value))))
				.filter((value) => Number.isFinite(value));
			if (scheme.length > 0) exercise.repsScheme = scheme;
		}
		if (typeof row.groupId === 'string' || row.groupId === null) {
			exercise.groupId = row.groupId as string | null;
		}
		if (typeof row.altGroupId === 'string' || row.altGroupId === null) {
			exercise.altGroupId = row.altGroupId as string | null;
		}
		out.push(exercise);
	}
	return out;
}

const INVITE_ALIASES: Record<string, string> = {
	O: '0',
	I: '1',
	L: '1',
	U: 'V'
};

/** Accepts any casing, spaces, dashes and the common OCR mistakes (O/0, I/1, L/1). */
export function normalizeInviteCode(raw: string): string {
	const cleaned = raw
		.toUpperCase()
		.replace(/[^0-9A-Z]/g, '')
		.split('')
		.map((ch) => INVITE_ALIASES[ch] ?? ch)
		.join('');
	return cleaned;
}

export function isValidInviteCode(raw: string): boolean {
	const code = normalizeInviteCode(raw);
	if (code.length !== INVITE_CODE_LENGTH) return false;
	for (const ch of code) {
		if (!INVITE_CODE_ALPHABET.includes(ch)) return false;
	}
	return true;
}

/** «ABCD1234» → «ABCD-1234» for reading out loud. */
export function formatInviteCode(raw: string): string {
	const code = normalizeInviteCode(raw);
	if (code.length !== INVITE_CODE_LENGTH) return code;
	return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function linkStatusLabelKey(status: CoachLinkStatus): string {
	switch (status) {
		case 'pending':
			return 'coach.statusPending';
		case 'active':
			return 'coach.statusActive';
		case 'revoked':
			return 'coach.statusRevoked';
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

export function createPendingLink(input: {
	id: string;
	coachUserId: string;
	clientUserId: string;
	now?: Date;
	note?: string;
}): CoachClientLink {
	const now = (input.now ?? new Date()).toISOString();
	return {
		id: input.id,
		coachUserId: input.coachUserId,
		clientUserId: input.clientUserId,
		status: 'pending',
		createdAt: now,
		updatedAt: now,
		...(input.note ? { note: input.note } : {})
	};
}

/** Client accepts: pending → active. Idempotent for an already active link. */
export function acceptLink(link: CoachClientLink, now: Date = new Date()): CoachClientLink {
	if (link.status !== 'pending') return link;
	return { ...link, status: 'active', updatedAt: now.toISOString() };
}

/** Either side can revoke. Revoked links never come back — create a new invite. */
export function revokeLink(link: CoachClientLink, now: Date = new Date()): CoachClientLink {
	if (link.status === 'revoked') return link;
	return { ...link, status: 'revoked', updatedAt: now.toISOString() };
}

export function isCoachOf(
	links: readonly CoachClientLink[],
	coachUserId: string,
	clientUserId: string
): boolean {
	return links.some(
		(l) =>
			l.status === 'active' &&
			l.coachUserId === coachUserId &&
			l.clientUserId === clientUserId
	);
}

export function activeClients(
	links: readonly CoachClientLink[],
	coachUserId: string
): CoachClientLink[] {
	return links
		.filter((l) => l.coachUserId === coachUserId && l.status === 'active')
		.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

/** A coach cannot exceed the plan limit without paying — checked before creating a link. */
export function canAddClient(
	links: readonly CoachClientLink[],
	coachUserId: string,
	limit = MAX_ACTIVE_CLIENTS
): boolean {
	return activeClients(links, coachUserId).length < limit;
}

const DAY_MS = 86_400_000;

export function summarizeClientSessions(
	sessions: readonly WorkoutSession[],
	now: Date = new Date()
): CoachSessionSummary {
	const nowMs = now.getTime();
	let sets = 0;
	let volumeKg = 0;
	let lastSessionAt: string | null = null;
	let sessions7d = 0;
	let finished = 0;

	for (const session of sessions) {
		if (!session.finishedAt) continue;
		finished++;
		const endedMs = Date.parse(session.finishedAt);
		if (Number.isFinite(endedMs) && nowMs - endedMs <= 7 * DAY_MS) sessions7d++;
		if (!lastSessionAt || session.finishedAt > lastSessionAt) lastSessionAt = session.finishedAt;
		for (const exercise of session.exercises) {
			for (const set of exercise.sets) {
				if (!set.completed) continue;
				sets++;
				if (set.weightKg != null && set.reps != null) volumeKg += set.weightKg * set.reps;
			}
		}
	}

	const lastMs = lastSessionAt ? Date.parse(lastSessionAt) : Number.NaN;
	return {
		sessions: finished,
		sets,
		volumeKg: Math.round(volumeKg),
		lastSessionAt,
		sessions7d,
		activeRecently: Number.isFinite(lastMs) && nowMs - lastMs <= 2 * DAY_MS
	};
}

export type ClientActivityTier = 'active' | 'calm' | 'stale' | 'silent';

/** Days since the last finished session, or null when there is none. */
export function daysSinceLastSession(
	summary: CoachSessionSummary,
	now: Date = new Date()
): number | null {
	if (!summary.lastSessionAt) return null;
	const ms = Date.parse(summary.lastSessionAt);
	if (!Number.isFinite(ms)) return null;
	return Math.max(0, Math.floor((now.getTime() - ms) / DAY_MS));
}

/**
 * Coach-facing signal: silence is the thing a coach acts on, so the tier is
 * driven by days since the last session rather than by a binary «active» flag.
 */
export function clientActivityTier(
	summary: CoachSessionSummary,
	now: Date = new Date()
): ClientActivityTier {
	const days = daysSinceLastSession(summary, now);
	if (days == null) return 'silent';
	if (days <= 2) return 'active';
	if (days <= 4) return 'calm';
	return 'stale';
}

export function runCoachSelfCheck(): void {
	const now = new Date('2026-02-10T12:00:00.000Z');

	if (!isValidInviteCode('abcd-1234')) throw new Error('coach: dashed code must be valid');
	if (isValidInviteCode('abcd-123')) throw new Error('coach: short code must be invalid');
	if (normalizeInviteCode('o i 0 l 2 3 4 5') !== '01012345') {
		throw new Error('coach: alias normalization drifted');
	}
	if (isValidInviteCode('oi0l2345') === false) throw new Error('coach: aliases must stay valid');
	if (formatInviteCode('abcd1234') !== 'ABCD-1234') throw new Error('coach: formatting failed');

	const pending = createPendingLink({
		id: 'l1',
		coachUserId: 'coach',
		clientUserId: 'client',
		now
	});
	if (pending.status !== 'pending') throw new Error('coach: link must start pending');
	if (isCoachOf([pending], 'coach', 'client')) throw new Error('coach: pending is not a link yet');

	const active = acceptLink(pending, now);
	if (active.status !== 'active' || !isCoachOf([active], 'coach', 'client')) {
		throw new Error('coach: accept must activate the link');
	}
	if (acceptLink(active, now) !== active) throw new Error('coach: accept must be idempotent');

	const revoked = revokeLink(active, now);
	if (revoked.status !== 'revoked' || isCoachOf([revoked], 'coach', 'client')) {
		throw new Error('coach: revoke must disable access');
	}
	if (revokeLink(revoked, now) !== revoked) throw new Error('coach: revoke must be idempotent');

	const links = Array.from({ length: MAX_ACTIVE_CLIENTS }, (_, i) => ({
		...active,
		id: `l${i}`,
		clientUserId: `c${i}`
	}));
	if (canAddClient(links, 'coach')) throw new Error('coach: limit must block new clients');
	if (activeClients([...links, revoked], 'coach').length !== MAX_ACTIVE_CLIENTS) {
		throw new Error('coach: revoked links must not count');
	}

	const sessions: WorkoutSession[] = [
		{
			id: 's1',
			planId: null,
			planName: 'Push',
			startedAt: '2026-02-09T10:00:00.000Z',
			finishedAt: '2026-02-09T11:00:00.000Z',
			exercises: [
				{
					exerciseId: 'e1',
					targetSets: 2,
					targetReps: 5,
					restSec: 90,
					sets: [
						{ weightKg: 100, reps: 5, completed: true },
						{ weightKg: 100, reps: 5, completed: true },
						{ weightKg: 120, reps: 5, completed: false }
					]
				}
			]
		},
		{
			id: 's2',
			planId: null,
			planName: 'Pull',
			startedAt: '2026-01-01T10:00:00.000Z',
			finishedAt: '2026-01-01T11:00:00.000Z',
			exercises: []
		}
	];
	const summary = summarizeClientSessions(sessions, now);
	if (summary.sessions !== 2) throw new Error('coach: only finished sessions count');
	if (summary.sets !== 2) throw new Error('coach: only completed sets count');
	if (summary.volumeKg !== 1000) throw new Error('coach: volume math drifted');
	if (summary.sessions7d !== 1) throw new Error('coach: 7d window drifted');
	if (!summary.activeRecently) throw new Error('coach: recent activity flag failed');
	if (summary.lastSessionAt !== '2026-02-09T11:00:00.000Z') {
		throw new Error('coach: last session drift');
	}
	if (daysSinceLastSession(summary, now) !== 1) throw new Error('coach: day math drifted');
	if (clientActivityTier(summary, now) !== 'active') throw new Error('coach: active tier failed');

	const idle = { ...summary, lastSessionAt: '2026-01-20T10:00:00.000Z' };
	if (clientActivityTier(idle, now) !== 'stale') throw new Error('coach: stale tier failed');
	const silent = { ...summary, lastSessionAt: null };
	if (clientActivityTier(silent, now) !== 'silent') throw new Error('coach: silent tier failed');
	if (daysSinceLastSession(silent, now) !== null) throw new Error('coach: no-session days failed');

	const parsed = parseCoachSessionExercises([
		{
			exerciseId: 'e1',
			targetSets: 2,
			targetReps: 5,
			restSec: 90,
			sets: [{ weightKg: 100, reps: 5, completed: true, kind: 'warmup' }]
		}
	]);
	if (parsed.length !== 1 || parsed[0]?.sets[0]?.kind !== 'warmup') {
		throw new Error('coach: session exercise parse drifted');
	}

	const planSnapshot = parseCoachPlanExercises([
		{
			exerciseId: 'e1',
			sets: 3,
			reps: 8,
			restSec: 90,
			repsScheme: [8, 8, 10],
			groupId: 'g1',
			altGroupId: null,
			weightKg: 999
		},
		{ exerciseId: '', sets: 3 },
		{ sets: 2, reps: 10 }
	]);
	if (planSnapshot.length !== 1) throw new Error('coach: plan snapshot must drop bad rows');
	const first = planSnapshot[0]!;
	if (first.sets !== 3 || first.reps !== 8 || first.restSec !== 90) {
		throw new Error('coach: plan snapshot numbers drifted');
	}
	if (first.repsScheme?.join(',') !== '8,8,10') {
		throw new Error('coach: plan snapshot scheme drifted');
	}
	if (first.groupId !== 'g1' || first.altGroupId !== null) {
		throw new Error('coach: plan snapshot groups drifted');
	}
	if ('weightKg' in first) throw new Error('coach: plan snapshot must drop unknown fields');
}
