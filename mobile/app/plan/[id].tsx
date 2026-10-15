import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
	lastPerformance,
	seedOpenSetsFromLastPerformance,
	startSessionFromPlan
} from '@repdraft/domain/session';
import type { WorkoutPlan } from '@repdraft/domain/types';
import {
	altGroupMemberRole,
	formatExercisePrescription,
	groupMemberRole
} from '@repdraft/domain/workout';
import { exerciseDisplayName, refreshCustomsCache } from '../../src/catalog/loadIndex';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useLocale } from '../../src/state/locale';
import { noteChecklist } from '../../src/state/onboarding';
import { plansRepo } from '../../src/storage/plansRepo';
import { sessionsRepo, writeActiveSession } from '../../src/storage/sessionsRepo';
import { colors } from '../../src/theme';

export default function PlanPreviewScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const { locale, tt } = useLocale();
	const [plan, setPlan] = useState<WorkoutPlan | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			await refreshCustomsCache();
			await noteChecklist('planReady');
			const found = id ? await plansRepo.get(id) : null;
			if (!cancelled) setPlan(found);
		})();
		return () => {
			cancelled = true;
		};
	}, [id]);

	async function start() {
		if (!plan || busy) return;
		setBusy(true);
		const history = await sessionsRepo.list();
		let session = startSessionFromPlan(plan);
		session = seedOpenSetsFromLastPerformance(session, (exerciseId) =>
			lastPerformance(history, exerciseId)
		);
		await writeActiveSession(session);
		setBusy(false);
		router.replace(`/live/${plan.id}`);
	}

	if (!plan) {
		return (
			<View style={styles.center}>
				<ActivityIndicator color={colors.accent} />
			</View>
		);
	}

	return (
		<View style={styles.root}>
			<ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
				<Text style={styles.title}>{plan.name}</Text>
				<Text style={styles.lead}>{tt('preview.today')}</Text>
				{plan.exercises.map((ex, i) => {
					const gRole = groupMemberRole(plan.exercises, i);
					const aRole = altGroupMemberRole(plan.exercises, i);
					const badge =
						gRole !== 'solo'
							? tt('preview.superset')
							: aRole !== 'solo'
								? tt('preview.or')
								: null;
					return (
						<Pressable
							key={`${ex.exerciseId}-${i}`}
							style={styles.card}
							onPress={() => router.push(`/exercise/${ex.exerciseId}`)}
						>
							{badge ? <Text style={styles.badge}>{badge}</Text> : null}
							<Text style={styles.cardTitle}>{exerciseDisplayName(ex.exerciseId, locale)}</Text>
							<Text style={styles.cardMeta}>{formatExercisePrescription(ex)}</Text>
						</Pressable>
					);
				})}
			</ScrollView>
			<View style={styles.footer}>
				<PrimaryButton
					label={busy ? '…' : tt('common.start')}
					onPress={() => void start()}
					disabled={busy || plan.exercises.length === 0}
				/>
				<PrimaryButton
					label={tt('builder.title')}
					variant="ghost"
					onPress={() => router.push(`/builder/${plan.id}`)}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	scroll: { padding: 16, gap: 10, paddingBottom: 24 },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
	title: { color: colors.text, fontSize: 24, fontWeight: '800' },
	lead: { color: colors.muted, marginBottom: 4 },
	card: {
		backgroundColor: colors.panel,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 14
	},
	badge: { color: colors.accent, fontSize: 11, fontWeight: '800', marginBottom: 4 },
	cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
	cardMeta: { color: colors.muted, marginTop: 4 },
	footer: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: colors.border }
});
