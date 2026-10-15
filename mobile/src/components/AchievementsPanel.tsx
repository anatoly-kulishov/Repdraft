import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
	ACHIEVEMENT_IDS,
	achievementHintKey,
	achievementTitleKey,
	isUnlocked,
	type AchievementId,
	type AchievementsState
} from '@repdraft/domain/achievements';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	state: AchievementsState;
	/** Highlight ids unlocked on the current summary session. */
	highlightIds?: AchievementId[] | null;
};

export function AchievementsPanel({ state, highlightIds }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const highlight = new Set(highlightIds ?? []);

	return (
		<View style={styles.list}>
			{ACHIEVEMENT_IDS.map((id) => {
				const unlocked = isUnlocked(state, id);
				const isNew = highlight.has(id);
				return (
					<View
						key={id}
						style={[
							styles.row,
							unlocked && styles.rowOn,
							isNew && styles.rowNew
						]}
					>
						<Text style={[styles.mark, unlocked && styles.markOn]}>
							{unlocked ? '✓' : '○'}
						</Text>
						<View style={styles.copy}>
							<Text style={[styles.title, !unlocked && styles.titleOff]}>
								{tt(achievementTitleKey(id))}
								{isNew ? ` · ${tt('achievements.new')}` : ''}
							</Text>
							<Text style={styles.hint}>{tt(achievementHintKey(id))}</Text>
						</View>
					</View>
				);
			})}
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		list: { gap: space.sm },
		row: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'flex-start',
			gap: space.md,
			paddingVertical: space.sm,
			paddingHorizontal: space.sm,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.bg
		},
		rowOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
		rowNew: { borderColor: colors.accent },
		mark: {
			color: colors.muted,
			fontWeight: '800',
			fontSize: 16,
			minWidth: 20,
			marginTop: 2
		},
		markOn: { color: colors.accent },
		copy: { flex: 1, gap: 2 },
		title: { color: colors.text, fontWeight: '700', fontSize: 15 },
		titleOff: { color: colors.muted },
		hint: { color: colors.muted, fontSize: 13, lineHeight: 18 }
	});
}
