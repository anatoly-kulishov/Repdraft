export {
	loggedSetKind,
	setKindMessageKey,
	isProgressSet,
	nextSetKind
} from './sessionSetKind';

export {
	visibleSessionExerciseIndices,
	altGroupNeedsPick,
	chooseAltExercise,
	pruneUnchosenAlts,
	nextManualExerciseFocus,
	nextFocusAfterSetComplete
} from './sessionAlts';

export {
	updateLoggedSet,
	updateExerciseNote,
	applyWeightToOpenSets,
	applyRepsToOpenSets,
	addLoggedSet,
	seedOpenSetsFromLastPerformance,
	fillOpenWeightsFromHistory,
	addCompletedLoggedSet,
	removeLoggedSet,
	removeLoggedExercise,
	skipSessionExercise,
	insertSessionExercise,
	replaceSessionExercise,
	canRemoveSessionExercise,
	restSecAfterSet,
	runSessionLogSelfCheck,
	type NewSessionExerciseOpts
} from './sessionLog';

export {
	startSessionFromPlan,
	syncSessionPrescriptionFromPlan,
	replaceSessionPlan,
	finishSession,
	mergeWorkoutSessions,
	planDraftFromSession,
	sessionDurationMs,
	sessionDurationMinutes,
	runSessionLifecycleSelfCheck
} from './sessionLifecycle';

export {
	previousSetAtIndex,
	suggestedSetPerformance,
	lastPerformance,
	recentExerciseLogs,
	completedSetCount,
	totalSetCount,
	completedExerciseCount,
	sessionVolumeKg,
	exerciseBestWeightKg,
	exerciseLogTopWeight,
	exerciseLogWeightDelta,
	previousPlanSession,
	exercisePlanVsActual,
	planVsActualParts,
	isSessionFullyLogged,
	finishedSessionLogEqual,
	type ExerciseSessionLog,
	type ExercisePlanVsActual
} from './sessionStats';
