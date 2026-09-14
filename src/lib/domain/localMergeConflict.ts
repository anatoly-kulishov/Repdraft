/** Counts for guest vs cloud workout data on first account bind. */
export type WorkoutDataPresence = {
	plans: number;
	sessions: number;
	records: number;
};

export type LocalMergeChoice = 'merge' | 'discard';

export function hasWorkoutData(presence: WorkoutDataPresence): boolean {
	return presence.plans > 0 || presence.sessions > 0 || presence.records > 0;
}

/** Guest local plans / sessions / records worth keeping or discarding. */
export function hasLocalGuestWorkoutData(presence: WorkoutDataPresence): boolean {
	return hasWorkoutData(presence);
}

/** Account already has cloud workouts (true conflict with guest local). */
export function hasCloudWorkoutData(presence: WorkoutDataPresence): boolean {
	return hasWorkoutData(presence);
}

export function runLocalMergeConflictSelfCheck(): void {
	if (hasLocalGuestWorkoutData({ plans: 0, sessions: 0, records: 0 })) {
		throw new Error('empty presence should be false');
	}
	if (!hasLocalGuestWorkoutData({ plans: 1, sessions: 0, records: 0 })) {
		throw new Error('plans should count as local data');
	}
	if (!hasCloudWorkoutData({ plans: 0, sessions: 2, records: 0 })) {
		throw new Error('sessions should count as cloud data');
	}
	if (!hasCloudWorkoutData({ plans: 0, sessions: 0, records: 1 })) {
		throw new Error('records should count as cloud data');
	}

	const choices: LocalMergeChoice[] = ['merge', 'discard'];
	for (const choice of choices) {
		switch (choice) {
			case 'merge':
			case 'discard':
				break;
			default: {
				const _exhaustive: never = choice;
				throw new Error(`unexpected choice ${_exhaustive}`);
			}
		}
	}
}
