/**
 * Cosmetic hero stats (1-99). Derived from logs and the hero profile. Not stored.
 */
import type { QuestHeroProfile } from './questHeroProfile';
import { finishedSessionsWithinDays } from './trainingLoad';
import type { WorkoutSession } from './types';

export type HeroDisplayStats = {
	strength: number;
	mass: number;
	endurance: number;
};

function clampStat(n: number): number {
	if (!Number.isFinite(n)) return 1;
	return Math.max(1, Math.min(99, Math.round(n)));
}

function bestWeightKg(session: WorkoutSession): number {
	let best = 0;
	for (const ex of session.exercises) {
		if (ex.skipped) continue;
		for (const set of ex.sets) {
			if (!set.completed || set.kind === 'warmup') continue;
			if (set.weightKg != null && set.weightKg > best) best = set.weightKg;
		}
	}
	return best;
}

function completedSets(session: WorkoutSession): number {
	let n = 0;
	for (const ex of session.exercises) {
		if (ex.skipped) continue;
		for (const set of ex.sets) {
			if (set.completed) n += 1;
		}
	}
	return n;
}

export function heroDisplayStats(input: {
	profile: QuestHeroProfile | null;
	sessions: readonly WorkoutSession[];
	now?: Date;
}): HeroDisplayStats {
	const now = input.now ?? new Date();
	const recent = finishedSessionsWithinDays([...input.sessions], 30, now);
	let peak = 0;
	let sets = 0;
	let volume = 0;
	for (const session of recent) {
		peak = Math.max(peak, bestWeightKg(session));
		sets += completedSets(session);
		for (const ex of session.exercises) {
			if (ex.skipped) continue;
			for (const set of ex.sets) {
				if (!set.completed || set.weightKg == null || set.reps == null) continue;
				if (set.weightKg <= 0 || set.reps <= 0) continue;
				volume += set.weightKg * set.reps;
			}
		}
	}

	const strength = clampStat(peak > 0 ? 20 + peak * 0.55 : 20);

	const profile = input.profile;
	let mass = 20 + volume / 800;
	if (profile?.weightKg != null && profile.heightCm != null && profile.heightCm > 0) {
		const meters = profile.heightCm / 100;
		const bmi = profile.weightKg / (meters * meters);
		mass = 20 + (bmi - 16) * 4.2;
	} else if (profile?.weightKg != null) {
		mass = profile.weightKg / 1.4;
	}

	const endurance = clampStat(15 + sets * 0.7);
	return {
		strength,
		mass: clampStat(mass),
		endurance
	};
}
