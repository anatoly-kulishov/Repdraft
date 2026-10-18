import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
	groupMemberRole,
	planExerciseSlotCount,
	planPrescribedSetCount,
	planTargetSummary
} from '@repdraft/domain/workout';
import {
	exerciseDisplayName,
	getIndexItem,
	loadExerciseIndex,
	refreshCustomsCache
} from '../../src/catalog/loadIndex';
import { Panel } from '../../src/components/Panel';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useBottomChromePad } from '../../src/layout/safe';
import { routeParam } from '../../src/nav/params';
import { useLocale } from '../../src/state/locale';
import { noteChecklist } from '../../src/state/onboarding';
import { useAppColors } from '../../src/state/theme';
import { plansRepo } from '../../src/storage/plansRepo';
import { readActiveSession, sessionsRepo, writeActiveSession } from '../../src/storage/sessionsRepo';
import { space, touchMin, type ColorPalette } from '../../src/theme';

export default function PlanPreviewScreen() {
	const { id: idParam } = useLocalSearchParams<{ id: string }>();
	const id = routeParam(idParam);
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.md);
	const scrollPad = bottomPad + 132;
	const [plan, setPlan] = useState<WorkoutPlan | null>(null);
	const [missing, setMissing] = useState(false);
	const [busy, setBusy] = useState(false);
	const [hasActive, setHasActive] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			await refreshCustomsCache();
			await noteChecklist('planReady');
			if (!id) {
				if (!cancelled) {
					setMissing(true);
					setPlan(null);
				}
				return;
			}
			const [found, active] = await Promise.all([
				plansRepo.get(id),
				readActiveSession()
			]);
			if (!cancelled) {
				setPlan(found);
				setMissing(!found);
				setHasActive(Boolean(active && !active.finishedAt && active.planId === id));
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [id]);

	async function start() {
		if (!plan || busy) return;
		setBusy(true);
		if (hasActive) {
			setBusy(false);
			router.replace(`/live/${plan.id}`);
			return;
		}
		const history = await sessionsRepo.list();
		let session = startSessionFromPlan(plan);
		session = seedOpenSetsFromLastPerformance(session, (exerciseId) =>
			lastPerformance(history, exerciseId)
		);
		await writeActiveSession(session);
		setBusy(false);
		router.replace(`/live/${plan.id}`);
	}

	if (missing) {
		return (
			<View style={styles.center}>
				<Text style={styles.missing}>{tt('builder.loadFail')}</Text>
				<PrimaryButton label={tt('summary.back')} onPress={() => router.replace('/')} />
			</View>
		);
	}

	if (!plan) {
		return (
			<View style={styles.center}>
				<ActivityIndicator color={colors.accent} />
			</View>
		);
	}

	const indexById = new Map(loadExerciseIndex().map((item) => [item.id, item] as const));
	const muscles = planTargetSummary(plan, indexById, locale);
	const sets = planPrescribedSetCount(plan);
	const slots = planExerciseSlotCount(plan);

	return (
		<View style={styles.root}>
			<ScrollView
				style={styles.flex}
				contentContainerStyle={[styles.scroll, { paddingBottom: scrollPad }]}
				keyboardShouldPersistTaps="handled"
			>
				<Text style={styles.title} numberOfLines={2}>
					{plan.name}
				</Text>
				<Text style={styles.lead}>{tt('preview.today')}</Text>
				<Text style={styles.metaLine}>
					{slots} {tt('common.exercises')} · {sets} {tt('summary.sets')}
					{muscles ? ` · ${muscles}` : ''}
				</Text>
				{plan.exercises.length === 0 ? (
					<Text style={styles.empty}>{tt('builder.empty')}</Text>
				) : null}
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
							onPress={() => router.push(`/exercise/${ex.exerciseId}`)}
						>
							<Panel style={styles.card}>
								{badge ? <Text style={styles.badge}>{badge}</Text> : null}
								<Text style={styles.cardTitle} numberOfLines={2}>
									{exerciseDisplayName(ex.exerciseId, locale)}
								</Text>
								<Text style={styles.cardMeta}>{formatExercisePrescription(ex)}</Text>
								{getIndexItem(ex.exerciseId)?.equipment ? (
									<Text style={styles.cardMeta}>{getIndexItem(ex.exerciseId)?.equipment}</Text>
								) : null}
							</Panel>
						</Pressable>
					);
				})}
			</ScrollView>
			<View style={[styles.footer, { paddingBottom: bottomPad }]}>
				{plan.exercises.length === 0 ? (
					<PrimaryButton
						label={tt('builder.add')}
						onPress={() => router.push(`/builder/${plan.id}`)}
					/>
				) : (
					<PrimaryButton
						label={busy ? '…' : hasActive ? tt('workouts.resume') : tt('common.start')}
						onPress={() => void start()}
						disabled={busy}
					/>
				)}
				<PrimaryButton
					label={tt('builder.title')}
					variant="link"
					onPress={() => router.push(`/builder/${plan.id}`)}
				/>
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		flex: { flex: 1 },
		scroll: { padding: space.lg, gap: space.sm },
		center: {
			flex: 1,
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: colors.bg,
			padding: space.lg,
			gap: space.md
		},
		missing: { color: colors.muted, textAlign: 'center' },
		empty: { color: colors.muted, marginTop: space.md, lineHeight: 22 },
		title: { color: colors.text, fontSize: 24, fontWeight: '800' },
		lead: { color: colors.muted, marginBottom: 4 },
		metaLine: { color: colors.muted, fontSize: 14, marginBottom: 4 },
		card: { minHeight: touchMin, gap: space.xs },
		badge: { color: colors.accentLink, fontSize: 11, fontWeight: '800' },
		cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
		cardMeta: { color: colors.muted },
		footer: {
			paddingHorizontal: space.lg,
			paddingTop: space.md,
			gap: space.sm,
			borderTopWidth: 1,
			borderTopColor: colors.border,
			backgroundColor: colors.bg
		}
	});
}
