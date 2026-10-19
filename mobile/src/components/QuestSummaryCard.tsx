import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
	STARTER_CAMPAIGN_CHAPTERS,
	heroLevel,
	type QuestApplyResult,
	type QuestState
} from '@repdraft/domain/quest';
import type { QuestHeroSex } from '@repdraft/domain/questHeroProfile';
import { figureZones, sessionPayoff } from '@repdraft/domain/sessionPayoff';
import type { WorkoutSession } from '@repdraft/domain/types';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, space, type ColorPalette } from '../theme';
import { HeroFigure } from './HeroFigure';
import { Panel } from './Panel';

type Props = {
	apply: QuestApplyResult;
	state: QuestState;
	session?: WorkoutSession | null;
	sex?: QuestHeroSex | null;
	bodyPartFor?: (exerciseId: string) => string | null;
	exerciseLabel?: (exerciseId: string) => string;
};

function chapterLabelFor(state: QuestState, tt: (k: string, v?: Record<string, string | number>) => string): string {
	const campaign = state.campaign;
	if (!campaign) return '-';
	if (campaign.status === 'completed') return tt('quest.campaignDone');
	if (campaign.status === 'paused') return tt('quest.campaignPaused');
	return tt('quest.chapter', {
		n: String(campaign.chapterIndex + 1),
		total: String(STARTER_CAMPAIGN_CHAPTERS)
	});
}

export function QuestSummaryCard({ apply, state, session = null, sex = null, bodyPartFor, exerciseLabel }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeCardStyles(colors), [colors]);

	const show = apply.xpGained > 0 || apply.counted;
	if (!show) return null;

	const level = heroLevel(state.hero.totalXp);
	const payoff = session ? sessionPayoff(session, bodyPartFor) : null;
	const zones = payoff ? figureZones(payoff.bodyParts) : [];
	const best = payoff?.best;
	const breakdown = apply.breakdown;

	return (
		<Panel style={styles.wrap}>
			<View style={styles.row}>
				<HeroFigure sex={sex} zones={zones} width={72} />
				<View style={styles.copy}>
					<Text style={styles.title}>{tt('quest.summaryTitle')}</Text>
					<Text style={styles.xp}>{tt('quest.xpGained', { xp: String(apply.xpGained) })}</Text>
					{breakdown?.base ? (
						<Text style={styles.meta}>{tt('quest.xpBase', { xp: String(breakdown.base) })}</Text>
					) : null}
					{breakdown?.weightUp ? (
						<Text style={styles.meta}>{tt('quest.xpWeight', { xp: String(breakdown.weightUp) })}</Text>
					) : null}
					{breakdown?.streakBonus ? (
						<Text style={styles.meta}>{tt('quest.xpStreak', { xp: String(breakdown.streakBonus) })}</Text>
					) : null}
					<Text style={styles.meta}>{tt('quest.levelLine', { level: String(level) })}</Text>
				</View>
			</View>
			{payoff ? (
				<>
					<Text style={styles.meta}>{tt('quest.volumeKg', { kg: String(payoff.volumeKg) })}</Text>
					<Text style={styles.meta}>{tt('quest.setsCount', { n: String(payoff.sets) })}</Text>
					{best ? (
						<Text style={styles.meta}>
							{tt('quest.bestSet', {
								name: exerciseLabel ? exerciseLabel(best.exerciseId) : best.exerciseId,
								weight: String(best.weightKg)
							})}
						</Text>
					) : null}
				</>
			) : null}
			{apply.goalJustMet ? <Text style={styles.badge}>{tt('quest.goalMet')}</Text> : null}
		</Panel>
	);
}

/** Compact progress for Profile when Quest is on. */
export function QuestProgressPanel({ state }: { state: QuestState }) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeProgressStyles(colors), [colors]);
	const level = heroLevel(state.hero.totalXp);
	const weekProgress = `${state.week.countedSessionIds.length}/${state.weeklyGoal}`;

	return (
		<View style={styles.progressBox}>
			<Text style={styles.meta}>
				{tt('quest.levelLine', { level: String(level) })}
				{' · '}
				{tt('quest.weekLine', { progress: weekProgress })}
			</Text>
			<Text style={styles.meta}>{chapterLabelFor(state, tt)}</Text>
			<Text style={styles.meta}>
				{tt('quest.xpTotal', { xp: String(state.hero.totalXp) })}
			</Text>
		</View>
	);
}

function makeCardStyles(colors: ColorPalette) {
	return StyleSheet.create({
		wrap: { gap: space.xs },
		row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
		copy: { flex: 1 },
		title: { color: colors.text, fontWeight: '700', fontSize: 16, fontFamily: fontFamily.bold },
		xp: {
			color: colors.xp,
			fontSize: 18,
			fontWeight: '800',
			fontVariant: ['tabular-nums'],
			marginTop: 2,
			fontFamily: fontFamily.extrabold
		},
		meta: { color: colors.muted, fontSize: 14, marginTop: 2, fontFamily: fontFamily.regular },
		badge: {
			color: colors.accent,
			fontWeight: '700',
			fontSize: 14,
			marginTop: space.xs,
			paddingTop: space.xs,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.border,
			fontFamily: fontFamily.bold
		}
	});
}

function makeProgressStyles(colors: ColorPalette) {
	return StyleSheet.create({
		progressBox: {
			marginTop: space.sm,
			paddingTop: space.sm,
			borderTopWidth: 1,
			borderTopColor: colors.border,
			gap: 4
		},
		meta: { color: colors.muted, fontSize: 14, fontFamily: fontFamily.regular }
	});
}
