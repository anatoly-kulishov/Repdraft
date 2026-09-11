import { addExercise, createEmptyDraft } from './workout.ts';
import {
	collectPlanTargetFacets,
	planHasTarget,
	planTargetKeys,
	planTargetSummary
} from './planTargets.ts';
import type { ExerciseIndexItem } from './types.ts';

const muscleIndex = new Map<string, ExerciseIndexItem>([
	[
		'ex-chest',
		{
			id: 'ex-chest',
			name: 'bench',
			body_part: 'chest',
			equipment: 'barbell',
			target: 'pectorals',
			muscle_group: 'chest',
			secondary_muscles: [],
			image: ''
		}
	],
	[
		'ex-back',
		{
			id: 'ex-back',
			name: 'row',
			body_part: 'back',
			equipment: 'barbell',
			target: 'lats',
			muscle_group: 'back',
			secondary_muscles: [],
			image: ''
		}
	]
]);

let musclePlanA = createEmptyDraft('Push');
musclePlanA = addExercise(musclePlanA, 'ex-chest').plan;
let musclePlanB = createEmptyDraft('Pull');
musclePlanB = addExercise(musclePlanB, 'ex-back').plan;

if (planTargetKeys(musclePlanA, muscleIndex).join(',') !== 'pectorals') {
	throw new Error('planTargetKeys should list primary targets in order');
}
if (!planHasTarget(musclePlanA, muscleIndex, 'pectorals')) {
	throw new Error('planHasTarget should match primary target');
}
if (planHasTarget(musclePlanA, muscleIndex, 'lats')) {
	throw new Error('planHasTarget should reject other targets');
}
if (planHasTarget(musclePlanA, muscleIndex, '')) {
	throw new Error('empty target key should not soft-match all');
}
const facets = collectPlanTargetFacets([musclePlanA, musclePlanB], muscleIndex, 'en');
if (facets.join(',') !== 'lats,pectorals') {
	throw new Error(`collectPlanTargetFacets unexpected ${facets.join(',')}`);
}
if (!planTargetSummary(musclePlanA, muscleIndex, 'en').toLowerCase().includes('pectoral')) {
	throw new Error('planTargetSummary should include labeled target');
}

console.log('planTargets.selfcheck: ok');
