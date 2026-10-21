import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View
} from 'react-native';
import { CircleCheck } from 'lucide-react-native';
import {
	achievementTitleKey,
	countableFinishedSessions,
	type AchievementId,
	type AchievementsState
} from '@repdraft/domain/achievements';
import { pickCatalogExerciseForBodyPart } from '@repdraft/domain/trainingLoad';
import type { QuestApplyResult, QuestState } from '@repdraft/domain/quest';
import type { QuestHeroProfile } from '@repdraft/domain/questHeroProfile';
import {
	completedExerciseCount,
	completedSetCount,
	loggedSetKind,
	previousPlanSession,
	sessionDurationMs,
	sessionVolumeKg,
	setKindMessageKey,
	visibleSessionExerciseIndices
} from '@repdraft/domain/session';
import { formatDurationMs } from '@repdraft/i18n/format';
import type { WorkoutSession } from '@repdraft/domain/types';
import {
	exerciseDisplayName,
	getIndexItem,
	loadExerciseIndex,
	refreshCustomsCache
} from '../../src/catalog/loadIndex';
import { AchievementUnlockSheet } from '../../src/components/AchievementUnlockSheet';
import { AchievementsPanel } from '../../src/components/AchievementsPanel';
import { SummaryLoadPanel } from '../../src/components/SummaryLoadPanel';
import { PageSkeleton } from '../../src/components/PageSkeleton';
import { Panel } from '../../src/components/Panel';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { QuestSummaryCard } from '../../src/components/QuestSummaryCard';
import {
	formatHealthSnapshotLine,
	loadLastHealthSnapshot,
	type HealthWorkoutSnapshot
} from '../../src/health';
import { useBottomChromePad } from '../../src/layout/safe';
import { routeParam } from '../../src/nav/params';
import {
	isAchievementsEnabled,
	loadAchievementsState,
	loadLastAchievementUnlock
} from '../../src/state/achievements';
import { appendExerciseToHomePlan } from '../../src/lib/planPatch';
import { useLocale } from '../../src/state/locale';
import { loadLastQuestApply, loadQuestState } from '../../src/state/quest';
import { loadQuestHeroProfile } from '../../src/state/questHero';
import { useAppColors } from '../../src/state/theme';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../../src/theme';

export default function SummaryScreen() {
	const { id: idParam } = useLocalSearchParams<{ id: string }>();
	const id = routeParam(idParam);
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.md);
	const scrollPad = bottomPad + 88;
	const [session, setSession] = useState<WorkoutSession | null>(null);
	const [prevVolume, setPrevVolume] = useState<number | null>(null);
	const [questApply, setQuestApply] = useState<QuestApplyResult | null>(null);
	const [questState, setQuestState] = useState<QuestState | null>(null);
	const [heroProfile, setHeroProfile] = useState<QuestHeroProfile | null>(null);
	const [achState, setAchState] = useState<AchievementsState | null>(null);
	const [newAchIds, setNewAchIds] = useState<AchievementId[] | null>(null);
	const [healthSnap, setHealthSnap] = useState<HealthWorkoutSnapshot | null>(null);
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const [allSessions, setAllSessions] = useState<WorkoutSession[]>([]);
	const [achModalDismissed, setAchModalDismissed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			await refreshCustomsCache();
			const found = id ? await sessionsRepo.get(id) : null;
			if (!cancelled) setSession(found);
			const all = await sessionsRepo.list();
			if (!cancelled) setAllSessions(all);
			if (found) {
				const prev = previousPlanSession(all, found);
				if (!cancelled) setPrevVolume(prev ? sessionVolumeKg(prev) : null);
			}
			if (id) {
				const [apply, st, hero] = await Promise.all([
					loadLastQuestApply(id),
					loadQuestState(),
					loadQuestHeroProfile()
				]);
				if (!cancelled) {
					setQuestApply(apply);
					setQuestState(st);
					setHeroProfile(hero);
				}
			}
			if (await isAchievementsEnabled()) {
				const [st, unlocked] = await Promise.all([
					loadAchievementsState(),
					id ? loadLastAchievementUnlock(id) : Promise.resolve(null)
				]);
				if (!cancelled) {
					setAchState(st);
					setNewAchIds(unlocked);
				}
			}
			if (id) {
				const snap = await loadLastHealthSnapshot(id);
				if (!cancelled) setHealthSnap(snap);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [id]);

	if (!session) {
		return <PageSkeleton variant="summary" />;
	}

	const volume = Math.round(sessionVolumeKg(session));
	const delta = prevVolume != null ? volume - Math.round(prevVolume) : null;
	const visible = visibleSessionExerciseIndices(session);
	const showAchModal = Boolean(newAchIds?.length && !achModalDismissed);
	const finishedForAch = countableFinishedSessions(allSessions);

	async function addLaggingToPlan(bodyPart: string) {
		const exerciseId = pickCatalogExerciseForBodyPart(loadExerciseIndex(), bodyPart);
		if (!exerciseId) {
			Alert.alert(tt('common.error'), tt('summary.addFail'));
			return;
		}
		const planId = await appendExerciseToHomePlan(exerciseId);
		if (!planId) {
			Alert.alert(tt('common.error'), tt('summary.addFail'));
			return;
		}
		router.push(`/builder/${planId}`);
	}

	return (
		<View style={styles.root}>
			<AchievementUnlockSheet
				ids={showAchModal ? newAchIds : null}
				onClose={() => {
					setAchModalDismissed(true);
					router.push('/achievements');
				}}
			/>
			<ScrollView
				style={styles.flex}
				contentContainerStyle={[styles.scroll, { paddingBottom: scrollPad }]}
			>
			<View style={styles.hero}>
				<CircleCheck size={48} color={colors.accent} strokeWidth={2} />
				<Text style={styles.title}>{tt('summary.title')}</Text>
				<Text style={styles.kicker} numberOfLines={2}>
					{session.planName}
				</Text>
			</View>
				{questApply && questState ? (
					<QuestSummaryCard
						apply={questApply}
						state={questState}
						session={session}
						sex={heroProfile?.sex ?? null}
						bodyPartFor={(exerciseId) => {
							const item = loadExerciseIndex().find((row) => row.id === exerciseId);
							return item?.body_part ?? null;
						}}
						exerciseLabel={(exerciseId) => exerciseDisplayName(exerciseId, locale)}
					/>
				) : null}
				{newAchIds && newAchIds.length > 0 ? (
					<Panel accent>
						<Text style={styles.achBannerTitle}>{tt('achievements.unlocked')}</Text>
						{newAchIds.map((aid) => (
							<Text key={aid} style={styles.achBannerLine}>
								{'• '}
								{tt(achievementTitleKey(aid))}
							</Text>
						))}
					</Panel>
				) : null}
				{healthSnap ? (
					<Panel>
						<Text style={styles.healthTitle}>{tt('health.fromHealth')}</Text>
						<Text style={styles.healthLine}>
							{formatHealthSnapshotLine(healthSnap, tt)}
						</Text>
					</Panel>
				) : null}
				<View style={styles.stats}>
					<View style={styles.stat}>
						<Text style={styles.statLabel}>{tt('summary.duration')}</Text>
						<Text style={styles.statValue}>
							{formatDurationMs(sessionDurationMs(session) ?? 0, { extended: true })}
						</Text>
					</View>
					<View style={styles.stat}>
						<Text style={styles.statLabel}>{tt('summary.exercises')}</Text>
						<Text style={styles.statValue}>{completedExerciseCount(session)}</Text>
					</View>
					<View style={styles.stat}>
						<Text style={styles.statLabel}>{tt('summary.sets')}</Text>
						<Text style={styles.statValue}>{completedSetCount(session)}</Text>
					</View>
					<View style={styles.stat}>
						<Text style={styles.statLabel}>{tt('summary.volume')}</Text>
						<Text style={styles.statValue}>{volume} {tt('pr.kg')}</Text>
						{delta != null && delta !== 0 ? (
							<Text style={styles.delta}>
								{tt(delta > 0 ? 'summary.volumeUp' : 'summary.volumeDown', {
									delta: Math.abs(delta)
								})}
							</Text>
						) : null}
					</View>
				</View>

				<SummaryLoadPanel
					session={session}
					allSessions={allSessions}
					bodyPartFor={(id) => getIndexItem(id)?.body_part ?? null}
					onAddLagging={(part) => void addLaggingToPlan(part)}
				/>

				{visible.map((ei) => {
					const ex = session.exercises[ei];
					if (!ex) return null;
					const key = `${ei}:${ex.exerciseId}`;
					const open = expanded[key] ?? true;
					const done = ex.sets.filter((s) => s.completed);
					return (
						<Panel key={key} style={styles.card}>
							<Pressable
								style={styles.cardHead}
								onPress={() => setExpanded((m) => ({ ...m, [key]: !open }))}
							>
								<Text style={styles.cardTitle} numberOfLines={2}>
									{exerciseDisplayName(ex.exerciseId, locale)}
								</Text>
								<Text style={styles.cardMeta}>
									{done.length}/{ex.sets.length}
								</Text>
							</Pressable>
							{open
								? done.map((set, si) => (
										<Text key={si} style={styles.setLine}>
											{si + 1}. {set.weightKg ?? '-'} × {set.reps ?? '-'} ·{' '}
											{tt(setKindMessageKey(loggedSetKind(set)))}
										</Text>
									))
								: null}
						</Panel>
					);
				})}
				{achState ? (
					<Panel>
						<Text style={styles.sectionTitle}>{tt('achievements.title')}</Text>
						<AchievementsPanel
							state={achState}
							finishedSessions={finishedForAch}
							highlightIds={newAchIds}
						/>
					</Panel>
				) : null}
			</ScrollView>
			<View style={[styles.footer, { paddingBottom: bottomPad }]}>
				<PrimaryButton label={tt('summary.back')} onPress={() => router.replace('/')} />
				<PrimaryButton
					label={tt('summary.openSession')}
					variant="link"
					onPress={() => router.push(`/history/${session.id}`)}
				/>
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	flex: { flex: 1 },
		scroll: { padding: space.lg, gap: space.md },
		hero: { alignItems: 'center', gap: space.sm },
		kicker: { color: colors.accentLink, fontWeight: '700', fontSize: 14, fontFamily: fontFamily.bold },
		title: { color: colors.text, fontSize: 24, fontWeight: '800', fontFamily: fontFamily.extrabold, textAlign: 'center' },
		sectionTitle: {
			color: colors.muted,
			fontWeight: '700',
			fontSize: 13,
			letterSpacing: 0.4,
			textTransform: 'uppercase',
			marginBottom: space.xs,
			fontFamily: fontFamily.bold
		},
		achBannerTitle: { color: colors.text, fontWeight: '800', fontSize: 16, fontFamily: fontFamily.extrabold },
		achBannerLine: { color: colors.accent, fontWeight: '600', fontSize: 14, fontFamily: fontFamily.semibold },
		healthTitle: { color: colors.text, fontWeight: '700', fontSize: 15, fontFamily: fontFamily.bold },
		healthLine: { color: colors.muted, fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular },
		stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
		stat: {
			width: '47%',
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.md
		},
		statLabel: { color: colors.muted, fontSize: 12, fontFamily: fontFamily.regular },
		statValue: {
			color: colors.text,
			fontSize: 22,
			fontWeight: '800',
			marginTop: 6,
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.extrabold
		},
		delta: { color: colors.muted, marginTop: 4, fontSize: 13, fontWeight: '600', fontFamily: fontFamily.semibold },
		card: { gap: 6 },
		cardHead: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: space.sm
		},
		cardTitle: { color: colors.text, fontWeight: '800', flex: 1, fontSize: 16, fontFamily: fontFamily.extrabold },
		cardMeta: { color: colors.muted, fontWeight: '600', fontFamily: fontFamily.semibold },
		setLine: { color: colors.muted, fontSize: 14, fontFamily: fontFamily.regular },
		footer: {
			paddingHorizontal: space.lg,
			paddingTop: space.md,
			borderTopWidth: 1,
			borderTopColor: colors.border,
			backgroundColor: colors.bg
		}
	});
}
