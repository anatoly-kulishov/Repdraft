import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
	STARTER_CAMPAIGN_CHAPTERS,
	heroXpProgress,
	questDailyHint,
	type QuestState
} from '@repdraft/domain/quest';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, type ColorPalette } from '../theme';
import { Panel } from './Panel';

function chapterLabel(
	state: QuestState,
	tt: (key: string, vars?: Record<string, string | number>) => string
): string {
	const campaign = state.campaign;
	if (!campaign) return '-';
	if (campaign.status === 'completed') return tt('quest.campaignDone');
	if (campaign.status === 'paused') return tt('quest.campaignPaused');
	return tt('quest.chapter', {
		n: String(campaign.chapterIndex + 1),
		total: String(STARTER_CAMPAIGN_CHAPTERS)
	});
}

type Props = {
	state: QuestState;
};

export function QuestHomeBanner({ state }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	const xp = heroXpProgress(state.hero.totalXp);
	const hint = questDailyHint(state);
	const weekProgress = `${state.week.countedSessionIds.length}/${state.weeklyGoal}`;
	const fillPct = Math.min(1, xp.xpInLevel / xp.xpForLevel);

	const hintText =
		hint.key === 'quest.dailyWeekly'
			? tt(hint.key, { n: String(hint.vars.n) })
			: hint.key === 'quest.dailySession'
				? tt(hint.key, { xp: String(hint.vars.xp) })
				: tt(hint.key);

	return (
		<Panel accent style={styles.wrap}>
			<Text style={styles.kicker}>{tt('quest.homeKicker')}</Text>
			<View style={styles.levelRow}>
				<Text style={styles.level}>{tt('quest.levelLine', { level: String(xp.level) })}</Text>
				<Text style={styles.xpNums}>
					{tt('quest.xpBar', {
						current: String(xp.xpInLevel),
						max: String(xp.xpForLevel)
					})}
				</Text>
			</View>
			<View
				style={styles.track}
				accessibilityRole="progressbar"
				accessibilityValue={{ min: 0, max: xp.xpForLevel, now: xp.xpInLevel }}
			>
				<View style={[styles.fill, { width: `${Math.round(fillPct * 100)}%` }]} />
			</View>
			<Text style={styles.meta}>
				{tt('quest.weekLine', { progress: weekProgress })}
				{' · '}
				{chapterLabel(state, tt)}
			</Text>
			<View style={styles.daily}>
				<Text style={styles.dailyLabel}>{tt('quest.dailyTitle')}</Text>
				<Text style={styles.dailyText}>{hintText}</Text>
			</View>
		</Panel>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		wrap: { gap: space.sm },
		kicker: {
			color: colors.muted,
			fontSize: 11,
			fontWeight: '800',
			letterSpacing: 0.8,
			textTransform: 'uppercase'
		},
		levelRow: {
			flexDirection: 'row',
			alignItems: 'baseline',
			justifyContent: 'space-between',
			gap: space.sm
		},
		level: { color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 },
		xpNums: {
			color: colors.muted,
			fontSize: 13,
			fontWeight: '600',
			fontVariant: ['tabular-nums']
		},
		track: {
			height: 8,
			borderRadius: radius.sm,
			backgroundColor: colors.border,
			overflow: 'hidden'
		},
		fill: {
			height: '100%',
			backgroundColor: colors.accent,
			borderRadius: radius.sm
		},
		meta: { color: colors.muted, fontSize: 13, lineHeight: 18 },
		daily: {
			marginTop: space.xs,
			paddingTop: space.sm,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.border,
			gap: 4
		},
		dailyLabel: {
			color: colors.muted,
			fontSize: 11,
			fontWeight: '800',
			letterSpacing: 0.6,
			textTransform: 'uppercase'
		},
		dailyText: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 20 }
	});
}
