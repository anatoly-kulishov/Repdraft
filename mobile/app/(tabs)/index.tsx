import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	View
} from 'react-native';
import {
	ONBOARDING_CHECKLIST_STEPS,
	buildDemoPlan,
	checklistProgress,
	shouldShowChecklist,
	type OnboardingState
} from '@repdraft/domain/onboarding';
import { createEmptyDraft, duplicatePlan, suggestNextPlan } from '@repdraft/domain/workout';
import type { WorkoutPlan } from '@repdraft/domain/types';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useLocale } from '../../src/state/locale';
import { dismissChecklist, noteChecklist } from '../../src/state/onboarding';
import { plansRepo } from '../../src/storage/plansRepo';
import { readActiveSession, sessionsRepo } from '../../src/storage/sessionsRepo';
import { pushPlan } from '../../src/sync/cloudSync';
import { colors, touchMin } from '../../src/theme';

export default function WorkoutsScreen() {
	const router = useRouter();
	const { tt } = useLocale();
	const [plans, setPlans] = useState<WorkoutPlan[]>([]);
	const [loading, setLoading] = useState(true);
	const [activePlanId, setActivePlanId] = useState<string | null>(null);
	const [lastFinishedPlanId, setLastFinishedPlanId] = useState<string | null>(null);
	const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);

	const reload = useCallback(async () => {
		setLoading(true);
		const [list, active, sessions] = await Promise.all([
			plansRepo.list(),
			readActiveSession(),
			sessionsRepo.list()
		]);
		const nextOb = await noteChecklist('homeSeen');
		const last = sessions.find((s) => s.finishedAt && s.planId);
		setPlans(list);
		setActivePlanId(active && !active.finishedAt ? active.planId : null);
		setLastFinishedPlanId(last?.planId ?? null);
		setOnboarding(nextOb);
		setLoading(false);
	}, []);

	useFocusEffect(
		useCallback(() => {
			void reload();
		}, [reload])
	);

	async function createBlank() {
		const plan = createEmptyDraft(tt('workouts.newName'));
		await plansRepo.save(plan);
		router.push(`/builder/${plan.id}`);
	}

	async function quickStart() {
		const plan = buildDemoPlan(tt('workouts.quick'));
		await plansRepo.save(plan);
		router.push(`/plan/${plan.id}`);
	}

	async function duplicate(plan: WorkoutPlan) {
		const copy = duplicatePlan(plan);
		await plansRepo.save(copy);
		try {
			await pushPlan(copy);
		} catch {
			/* offline */
		}
		router.push(`/builder/${copy.id}`);
	}

	if (loading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator color={colors.accent} />
			</View>
		);
	}

	const next = suggestNextPlan(plans, lastFinishedPlanId);
	const showChecklist = onboarding ? shouldShowChecklist(onboarding) : false;
	const progress = onboarding ? checklistProgress(onboarding) : null;

	return (
		<View style={styles.root}>
			<Text style={styles.lead}>{tt('workouts.lead')}</Text>
			{showChecklist && onboarding && progress ? (
				<View style={styles.checklist}>
					<Text style={styles.checkTitle}>
						{tt('onboarding.title')} ({progress.done}/{progress.total})
					</Text>
					{ONBOARDING_CHECKLIST_STEPS.map((step) => (
						<Text
							key={step}
							style={[styles.checkItem, onboarding.checklist[step] && styles.checkDone]}
						>
							{onboarding.checklist[step] ? '✓ ' : '○ '}
							{tt(
								step === 'homeSeen'
									? 'onboarding.home'
									: step === 'planReady'
										? 'onboarding.plan'
										: step === 'liveEntered'
											? 'onboarding.live'
											: step === 'setLogged'
												? 'onboarding.set'
												: 'onboarding.finish'
							)}
						</Text>
					))}
					<PrimaryButton
						label={tt('onboarding.dismiss')}
						variant="ghost"
						onPress={() => void dismissChecklist().then(setOnboarding)}
					/>
				</View>
			) : null}
			{activePlanId ? (
				<PrimaryButton
					label={tt('workouts.resume')}
					onPress={() => router.push(`/live/${activePlanId}`)}
				/>
			) : next ? (
				<PrimaryButton
					label={`${tt('common.start')}: ${next.name}`}
					onPress={() => router.push(`/plan/${next.id}`)}
				/>
			) : null}
			<View style={styles.rowActions}>
				<View style={styles.flex}>
					<PrimaryButton label={tt('workouts.create')} onPress={() => void createBlank()} />
				</View>
				<View style={styles.flex}>
					<PrimaryButton
						label={tt('workouts.quick')}
						variant="ghost"
						onPress={() => void quickStart()}
					/>
				</View>
			</View>
			<PrimaryButton
				label={tt('workouts.history')}
				variant="ghost"
				onPress={() => router.push('/history')}
			/>
			<PrimaryButton label={tt('ai.open')} variant="ghost" onPress={() => router.push('/ai')} />
			<FlatList
				data={plans}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.list}
				ListEmptyComponent={<Text style={styles.empty}>{tt('workouts.empty')}</Text>}
				renderItem={({ item }) => (
					<Pressable
						accessibilityRole="button"
						style={styles.row}
						onPress={() => router.push(`/plan/${item.id}`)}
						onLongPress={() => void duplicate(item)}
					>
						<View style={{ flex: 1 }}>
							<Text style={styles.rowTitle}>{item.name || '-'}</Text>
							<Text style={styles.rowMeta}>
								{item.exercises.length} {tt('common.exercises')}
							</Text>
						</View>
						<Text style={styles.dupHint}>{tt('workouts.duplicate')}</Text>
					</Pressable>
				)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 16, gap: 12, backgroundColor: colors.bg },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
	lead: { color: colors.muted, fontSize: 15, lineHeight: 22 },
	checklist: {
		backgroundColor: colors.panel,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 14,
		gap: 6
	},
	checkTitle: { color: colors.text, fontWeight: '800', marginBottom: 4 },
	checkItem: { color: colors.muted, fontSize: 14 },
	checkDone: { color: colors.accent },
	rowActions: { flexDirection: 'row', gap: 8 },
	flex: { flex: 1 },
	list: { flexGrow: 1, gap: 8, paddingVertical: 8 },
	empty: { color: colors.muted, textAlign: 'center', marginTop: 40 },
	row: {
		minHeight: touchMin,
		backgroundColor: colors.panel,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		paddingHorizontal: 16,
		paddingVertical: 14,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8
	},
	rowTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
	rowMeta: { color: colors.muted, marginTop: 4, fontSize: 13 },
	dupHint: { color: colors.muted, fontSize: 12, fontWeight: '600' }
});
