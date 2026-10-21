import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { exerciseMetaHint } from '@repdraft/domain/labels.ru';
import { shouldShowCoachmark } from '@repdraft/domain/onboarding';
import {
	exerciseDisplayName,
	getIndexItem,
	loadExerciseIndex,
	refreshCustomsCache
} from '../../src/catalog/loadIndex';
import { CatalogThumb } from '../../src/components/CatalogThumb';
import { Coachmark } from '../../src/components/Coachmark';
import { PageSkeleton } from '../../src/components/PageSkeleton';
import { Panel } from '../../src/components/Panel';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useBottomChromePad } from '../../src/layout/safe';
import { routeParam } from '../../src/nav/params';
import { useLocale } from '../../src/state/locale';
import { dismissCoachmark, loadOnboarding, noteChecklist } from '../../src/state/onboarding';
import { useAppColors } from '../../src/state/theme';
import { plansRepo } from '../../src/storage/plansRepo';
import { readActiveSession, sessionsRepo, writeActiveSession } from '../../src/storage/sessionsRepo';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../../src/theme';

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
	const [showCoachmark, setShowCoachmark] = useState(false);
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			await refreshCustomsCache();
			await noteChecklist('planReady');
			const ob = await loadOnboarding();
			if (!cancelled) {
				setShowCoachmark(shouldShowCoachmark(ob, 'preview.start'));
			}
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

	async function beginStart() {
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

	async function start() {
		if (!plan || busy) return;
		await beginStart();
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
		return <PageSkeleton variant="planPreview" />;
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
					{tt('preview.stats', { exercises: slots, sets })}
					{muscles ? ` · ${muscles}` : ''}
				</Text>
				{plan.exercises.length === 0 ? (
					<Text style={styles.empty}>{tt('builder.empty')}</Text>
				) : null}
				{showCoachmark ? (
					<Coachmark
						message={tt('onboarding.coachPreviewStart')}
						onDismiss={() => {
							setShowCoachmark(false);
							void dismissCoachmark('preview.start');
						}}
					/>
				) : null}
				{plan.exercises.map((ex, i) => {
					const gRole = groupMemberRole(plan.exercises, i);
					const aRole = altGroupMemberRole(plan.exercises, i);
					const badge =
						gRole !== 'solo'
							? tt('preview.superset')
							: aRole !== 'solo'
								? tt('builder.orBadge')
								: null;
					const item = getIndexItem(ex.exerciseId);
					const metaHint = item ? exerciseMetaHint(item, locale) : '';
					return (
						<Pressable
							key={`${ex.exerciseId}-${i}`}
							style={({ pressed }) => pressed && styles.pressed}
							onPress={() => router.push(`/exercise/${ex.exerciseId}`)}
						>
							<Panel style={styles.card}>
								<View style={styles.cardRow}>
									<CatalogThumb imagePath={item?.image} size={56} rounded={radius.sm} />
									<View style={styles.cardBody}>
										{badge ? <Text style={styles.badge}>{badge}</Text> : null}
										<Text style={styles.cardTitle} numberOfLines={2}>
											{exerciseDisplayName(ex.exerciseId, locale)}
										</Text>
										<Text style={styles.cardMeta}>{formatExercisePrescription(ex)} · {metaHint || item?.equipment || '-'}</Text>
									</View>
								</View>
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
						label={busy ? tt('common.loading') : hasActive ? tt('workouts.resume') : tt('common.start')}
						onPress={() => void start()}
						disabled={busy}
					/>
				)}
				<PrimaryButton
					label={tt('preview.edit')}
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
		missing: { color: colors.muted, textAlign: 'center', fontFamily: fontFamily.regular },
		empty: { color: colors.muted, marginTop: space.md, lineHeight: 22, fontFamily: fontFamily.regular },
		title: { color: colors.text, fontSize: 24, fontWeight: '800', fontFamily: fontFamily.extrabold },
		lead: { color: colors.muted, marginBottom: 4, fontFamily: fontFamily.regular },
		metaLine: { color: colors.muted, fontSize: 14, marginBottom: 4, fontFamily: fontFamily.regular },
		card: { minHeight: touchMin, gap: space.xs },
		cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
		cardBody: { flex: 1, gap: space.xs },
		pressed: { opacity: 0.85 },
		badge: { color: colors.accentLink, fontSize: 11, fontWeight: '800', fontFamily: fontFamily.extrabold },
		cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: fontFamily.bold },
		cardMeta: { color: colors.muted, fontFamily: fontFamily.regular },
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
