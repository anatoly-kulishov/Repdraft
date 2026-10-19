import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { addExercise, createEmptyDraft } from '@repdraft/domain/workout';
import type { ExerciseIndexItem, WorkoutPlan } from '@repdraft/domain/types';
import { AddToPlanSheet } from '../components/AddToPlanSheet';
import { useLocale } from '../state/locale';
import { plansRepo } from '../storage/plansRepo';
import { pushPlan } from '../sync/cloudSync';

export function useAddToPlan() {
	const router = useRouter();
	const { tt } = useLocale();

	const addToPlan = useCallback(
		async (item: ExerciseIndexItem, planId: string | 'new') => {
			try {
				let plan =
					planId === 'new'
						? createEmptyDraft(tt('workouts.newName'))
						: await plansRepo.get(planId);
				if (!plan) {
					Alert.alert(tt('builder.loadFail'));
					return;
				}
				const { plan: next, added } = addExercise(plan, item.id, {
					name: item.name,
					equipment: item.equipment
				});
				if (!added) {
					Alert.alert(tt('builder.alreadyInPlan'));
					router.push(`/builder/${plan.id}`);
					return;
				}
				await plansRepo.save(next);
				try {
					await pushPlan(next);
				} catch {
					/* offline */
				}
				router.push(`/builder/${next.id}`);
			} catch {
				Alert.alert(tt('builder.saveFail'));
			}
		},
		[router, tt]
	);

	const [pending, setPending] = useState<ExerciseIndexItem | null>(null);
	const [plans, setPlans] = useState<WorkoutPlan[]>([]);

	const offerAddToPlan = useCallback((item: ExerciseIndexItem) => {
		void plansRepo.list().then((list) => {
			setPlans(list);
			setPending(item);
		});
	}, []);

	const dismiss = useCallback(() => setPending(null), []);

	const pick = useCallback(
		(planId: string | 'new') => {
			const item = pending;
			setPending(null);
			if (item) void addToPlan(item, planId);
		},
		[addToPlan, pending]
	);

	const sheet = pending ? (
		<AddToPlanSheet
			open
			plans={plans}
			onCreate={() => pick('new')}
			onPick={(id) => pick(id)}
			onDismiss={dismiss}
		/>
	) : null;

	return { addToPlan, offerAddToPlan, sheet };
}
