import type { LoggedSet, SetKind } from './types';

export function loggedSetKind(set: LoggedSet): SetKind {
	return set.kind ?? 'work';
}

/** i18n key for set type labels (live + history). */
export function setKindMessageKey(kind: SetKind): string {
	switch (kind) {
		case 'work':
			return 'live.setKindWork';
		case 'warmup':
			return 'live.setKindWarmup';
		case 'drop':
			return 'live.setKindDrop';
		case 'failure':
			return 'live.setKindFailure';
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/** Working sets drive “last time” / progress memory (skip warm-up). */
export function isProgressSet(set: LoggedSet): boolean {
	return loggedSetKind(set) !== 'warmup';
}

export function nextSetKind(kind: SetKind): SetKind {
	switch (kind) {
		case 'work':
			return 'warmup';
		case 'warmup':
			return 'drop';
		case 'drop':
			return 'failure';
		case 'failure':
			return 'work';
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}
