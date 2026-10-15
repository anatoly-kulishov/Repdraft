import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
	STARTER_CAMPAIGN_CHAPTERS,
	heroLevel,
	type QuestApplyResult,
	type QuestState
} from '@repdraft/domain/quest';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { space, type ColorPalette } from '../theme';
import { Panel } from './Panel';

type Props = {
	apply: QuestApplyResult;
	state: QuestState;
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

export function QuestSummaryCard({ apply, state }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeCardStyles(colors), [colors]);

	const show = apply.xpGained > 0 || apply.counted;
	if (!show) return null;

	const level = heroLevel(state.hero.totalXp);
	const weekProgress = `${state.week.countedSessionIds.length}/${state.weeklyGoal}`;

	return (
		<Panel accent style={styles.wrap}>
			<Text style={styles.title}>{tt('quest.summaryTitle')}</Text>
			<Text style={styles.xp}>{tt('quest.xpGained', { xp: String(apply.xpGained) })}</Text>
			<Text style={styles.meta}>
				{tt('quest.levelLine', { level: String(level) })}
				{' · '}
				{tt('quest.weekLine', { progress: weekProgress })}
			</Text>
			<Text style={styles.meta}>{chapterLabelFor(state, tt)}</Text>
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
		title: { color: colors.text, fontWeight: '700', fontSize: 16 },
		xp: {
			color: colors.accent,
			fontSize: 18,
			fontWeight: '800',
			fontVariant: ['tabular-nums'],
			marginTop: 2
		},
		meta: { color: colors.muted, fontSize: 14, marginTop: 2 },
		badge: {
			color: colors.accent,
			fontWeight: '700',
			fontSize: 14,
			marginTop: space.xs,
			paddingTop: space.xs,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.border
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
		meta: { color: colors.muted, fontSize: 14 }
	});
}
