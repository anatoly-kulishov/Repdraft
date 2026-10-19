import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { heroDisplayStats } from '@repdraft/domain/heroStats';
import {
	STARTER_CAMPAIGN_CHAPTERS,
	heroXpProgress,
	questDailyHint,
	type QuestState
} from '@repdraft/domain/quest';
import type { QuestHeroProfile } from '@repdraft/domain/questHeroProfile';
import type { WorkoutSession } from '@repdraft/domain/types';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../theme';
import { HeroFigure } from './HeroFigure';
import { Panel } from './Panel';

function chapterLabel(
	state: QuestState,
	tt: (key: string, vars?: Record<string, string | number>) => string
): string {
	const campaign = state.campaign;
	if (!campaign) return '';
	if (campaign.status === 'completed') return tt('quest.campaignDone');
	if (campaign.status === 'paused') return tt('quest.campaignPaused');
	return tt('quest.chapter', {
		n: String(campaign.chapterIndex + 1),
		total: String(STARTER_CAMPAIGN_CHAPTERS)
	});
}

type Props = {
	state: QuestState;
	profile: QuestHeroProfile | null;
	sessions: readonly WorkoutSession[];
	raiseName?: string | null;
};

/** Twin of web `QuestHomeBanner.svelte`. */
export function QuestHomeBanner({ state, profile, sessions, raiseName = null }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const xp = heroXpProgress(state.hero.totalXp);
	const hint = questDailyHint(state, raiseName);
	const stats = heroDisplayStats({ profile, sessions });
	const fillPct = Math.min(1, xp.xpInLevel / xp.xpForLevel);
	const name = profile?.displayName.trim() || tt('quest.heroNameless');
	const chapter = chapterLabel(state, tt);
	const hintText =
		hint.key === 'quest.dailyRaise'
			? tt(hint.key, { name: hint.vars.name })
			: hint.key === 'quest.dailyWeekly'
				? tt(hint.key, { n: String(hint.vars.n) })
				: hint.key === 'quest.dailySession'
					? tt(hint.key, { xp: String(hint.vars.xp) })
					: tt(hint.key);
	const pills = [
		{ key: 'quest.statStrength', value: String(stats.strength) },
		{ key: 'quest.statMass', value: String(stats.mass) },
		{ key: 'quest.statEndurance', value: String(stats.endurance) },
		{ key: 'quest.onboardWeight', value: profile?.weightKg != null ? String(profile.weightKg) : '-' },
		{ key: 'quest.onboardHeight', value: profile?.heightCm != null ? String(profile.heightCm) : '-' },
		{ key: 'quest.onboardAge', value: profile?.age != null ? String(profile.age) : '-' }
	];

	return (
		<Panel style={styles.wrap}>
			<View style={styles.row}>
				<HeroFigure sex={profile?.sex ?? null} width={88} />
				<View style={styles.copy}>
					<Text style={styles.name} numberOfLines={1}>
						{name}
					</Text>
					<View style={styles.levelRow}>
						<Text style={styles.level}>{tt('quest.levelLine', { level: String(xp.level) })}</Text>
						<Text style={styles.xpNums}>
							{tt('quest.xpBar', { current: String(xp.xpInLevel), max: String(xp.xpForLevel) })}
						</Text>
					</View>
					<View
						style={styles.track}
						accessibilityRole="progressbar"
						accessibilityValue={{ min: 0, max: xp.xpForLevel, now: xp.xpInLevel }}
					>
						<View style={[styles.fill, { width: `${Math.round(fillPct * 100)}%` }]} />
					</View>
					{state.streakBroken ? (
						<Text style={styles.chipBroken}>{tt('quest.streakBroken')}</Text>
					) : state.streakWeeks >= 2 ? (
						<Text style={styles.chip}>{tt('quest.streakBonus')}</Text>
					) : null}
					{chapter ? <Text style={styles.meta}>{chapter}</Text> : null}
				</View>
			</View>
			<View style={styles.pills}>
				{pills.map((pill) => (
					<View key={pill.key} style={styles.pill}>
						<Text style={styles.pillLabel}>{tt(pill.key)}</Text>
						<Text style={styles.pillValue}>{pill.value}</Text>
					</View>
				))}
			</View>
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
		row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
		copy: { flex: 1, gap: 4 },
		name: { color: colors.text, fontSize: 18, fontWeight: '800', fontFamily: fontFamily.extrabold },
		levelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
		level: { color: colors.text, fontSize: 13, fontFamily: fontFamily.semibold },
		xpNums: { color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'], fontFamily: fontFamily.semibold },
		track: { height: 8, borderRadius: radius.sm, backgroundColor: colors.border, overflow: 'hidden' },
		fill: { height: '100%', backgroundColor: colors.xp, borderRadius: radius.sm },
		chip: { color: colors.xp, fontSize: 12, fontWeight: '700', fontFamily: fontFamily.bold },
		chipBroken: { color: colors.danger, fontSize: 12, fontWeight: '700', fontFamily: fontFamily.bold },
		meta: { color: colors.muted, fontSize: 12, fontFamily: fontFamily.regular },
		pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
		pill: {
			minWidth: '30%',
			flexGrow: 1,
			minHeight: 48,
			justifyContent: 'center',
			paddingHorizontal: space.sm,
			borderRadius: 999,
			backgroundColor: colors.panel
		},
		pillLabel: { color: colors.muted, fontSize: 11, fontFamily: fontFamily.regular },
		pillValue: { color: colors.text, fontSize: 14, fontWeight: '700', fontFamily: fontFamily.bold },
		daily: { gap: 4, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
		dailyLabel: {
			color: colors.muted,
			fontSize: 11,
			fontWeight: '800',
			letterSpacing: 0.6,
			textTransform: 'uppercase',
			fontFamily: fontFamily.extrabold
		},
		dailyText: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 20, fontFamily: fontFamily.semibold }
	});
}
