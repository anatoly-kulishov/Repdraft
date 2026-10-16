import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View
} from 'react-native';
import {
	achievementTitleKey,
	type AchievementId,
	type AchievementsState
} from '@repdraft/domain/achievements';
import type { QuestApplyResult, QuestState } from '@repdraft/domain/quest';
import {
	completedExerciseCount,
	completedSetCount,
	loggedSetKind,
	previousPlanSession,
	sessionDurationMs,
	sessionVolumeKg,
	visibleSessionExerciseIndices
} from '@repdraft/domain/session';
import type { WorkoutSession } from '@repdraft/domain/types';
import { exerciseDisplayName, refreshCustomsCache } from '../../src/catalog/loadIndex';
import { AchievementsPanel } from '../../src/components/AchievementsPanel';
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
import { useLocale } from '../../src/state/locale';
import { isQuestEnabled, loadLastQuestApply, loadQuestState } from '../../src/state/quest';
import { useAppColors } from '../../src/state/theme';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { radius, space, touchMin, type ColorPalette } from '../../src/theme';

function formatDuration(ms: number): string {
	const totalSec = Math.max(0, Math.round(ms / 1000));
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

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
	const [achState, setAchState] = useState<AchievementsState | null>(null);
	const [newAchIds, setNewAchIds] = useState<AchievementId[] | null>(null);
	const [healthSnap, setHealthSnap] = useState<HealthWorkoutSnapshot | null>(null);
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			await refreshCustomsCache();
			const found = id ? await sessionsRepo.get(id) : null;
			if (!cancelled) setSession(found);
			if (found) {
				const all = await sessionsRepo.list();
				const prev = previousPlanSession(all, found);
				if (!cancelled) setPrevVolume(prev ? sessionVolumeKg(prev) : null);
			}
			if (id && (await isQuestEnabled())) {
				const [apply, st] = await Promise.all([
					loadLastQuestApply(id),
					loadQuestState()
				]);
				if (!cancelled) {
					setQuestApply(apply);
					setQuestState(st);
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
		return (
			<View style={styles.center}>
				<ActivityIndicator color={colors.accent} />
			</View>
		);
	}

	const volume = Math.round(sessionVolumeKg(session));
	const delta = prevVolume != null ? volume - Math.round(prevVolume) : null;
	const visible = visibleSessionExerciseIndices(session);

	return (
		<View style={styles.root}>
			<ScrollView
				style={styles.flex}
				contentContainerStyle={[styles.scroll, { paddingBottom: scrollPad }]}
			>
				<Text style={styles.kicker}>{tt('summary.saved')}</Text>
				<Text style={styles.title} numberOfLines={2}>
					{session.planName}
				</Text>
				{questApply && questState ? (
					<QuestSummaryCard apply={questApply} state={questState} />
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
						<Text style={styles.statLabel}>{tt('summary.time')}</Text>
						<Text style={styles.statValue}>
							{formatDuration(sessionDurationMs(session) ?? 0)}
						</Text>
					</View>
					<View style={styles.stat}>
						<Text style={styles.statLabel}>{tt('common.exercises')}</Text>
						<Text style={styles.statValue}>{completedExerciseCount(session)}</Text>
					</View>
					<View style={styles.stat}>
						<Text style={styles.statLabel}>{tt('summary.sets')}</Text>
						<Text style={styles.statValue}>{completedSetCount(session)}</Text>
					</View>
					<View style={styles.stat}>
						<Text style={styles.statLabel}>{tt('summary.volume')}</Text>
						<Text style={styles.statValue}>{volume}</Text>
						{delta != null ? (
							<Text style={styles.delta}>
								{delta > 0 ? `+${delta}` : String(delta)}
							</Text>
						) : null}
					</View>
				</View>

				{visible.map((ei) => {
					const ex = session.exercises[ei];
					if (!ex) return null;
					const key = `${ei}:${ex.exerciseId}`;
					const open = expanded[key] ?? true;
					const done = ex.sets.filter((s) => s.completed);
					return (
						<View key={key} style={styles.card}>
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
											{tt(
												loggedSetKind(set) === 'warmup'
													? 'live.setKindWarmup'
													: loggedSetKind(set) === 'drop'
														? 'live.setKindDrop'
														: loggedSetKind(set) === 'failure'
															? 'live.setKindFailure'
															: 'live.setKindWork'
											)}
										</Text>
									))
								: null}
						</View>
					);
				})}
				{achState ? (
					<Panel>
						<Text style={styles.sectionTitle}>{tt('achievements.title')}</Text>
						<AchievementsPanel state={achState} highlightIds={newAchIds} />
					</Panel>
				) : null}
			</ScrollView>
			<View style={[styles.footer, { paddingBottom: bottomPad }]}>
				<PrimaryButton label={tt('summary.back')} onPress={() => router.replace('/')} />
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		flex: { flex: 1 },
		scroll: { padding: space.lg, gap: space.md },
		center: {
			flex: 1,
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: colors.bg
		},
		kicker: { color: colors.accent, fontWeight: '700', fontSize: 14 },
		title: { color: colors.text, fontSize: 24, fontWeight: '800' },
		sectionTitle: {
			color: colors.muted,
			fontWeight: '700',
			fontSize: 13,
			letterSpacing: 0.4,
			textTransform: 'uppercase',
			marginBottom: space.xs
		},
		achBannerTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
		achBannerLine: { color: colors.accent, fontWeight: '600', fontSize: 14 },
		healthTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
		healthLine: { color: colors.muted, fontSize: 14, lineHeight: 20 },
		stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
		stat: {
			width: '47%',
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.md
		},
		statLabel: { color: colors.muted, fontSize: 12 },
		statValue: {
			color: colors.text,
			fontSize: 22,
			fontWeight: '800',
			marginTop: 6,
			fontVariant: ['tabular-nums']
		},
		delta: { color: colors.muted, marginTop: 4, fontSize: 13, fontWeight: '600' },
		card: {
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.md,
			gap: 6
		},
		cardHead: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: space.sm
		},
		cardTitle: { color: colors.text, fontWeight: '800', flex: 1, fontSize: 16 },
		cardMeta: { color: colors.muted, fontWeight: '600' },
		setLine: { color: colors.muted, fontSize: 14 },
		footer: {
			paddingHorizontal: space.lg,
			paddingTop: space.md,
			borderTopWidth: 1,
			borderTopColor: colors.border,
			backgroundColor: colors.bg
		}
	});
}
