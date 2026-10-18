import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
	ACHIEVEMENT_IDS,
	achievementCategory,
	achievementHintKey,
	achievementProgressList,
	achievementTitleKey,
	isUnlocked,
	type AchievementCategory,
	type AchievementId,
	type AchievementsState
} from '@repdraft/domain/achievements';
import type { WorkoutSession } from '@repdraft/domain/types';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, touchMin, type ColorPalette } from '../theme';
import { Chip } from './Chip';

type Props = {
	state: AchievementsState;
	finishedSessions?: WorkoutSession[];
	highlightIds?: AchievementId[] | null;
	showFilters?: boolean;
};

const FILTERS: AchievementCategory[] = ['all', 'routine', 'quest', 'records'];

export function AchievementsPanel({
	state,
	finishedSessions = [],
	highlightIds,
	showFilters = false
}: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const [filter, setFilter] = useState<AchievementCategory>('all');
	const highlight = new Set(highlightIds ?? []);
	const progress = useMemo(
		() => achievementProgressList(state, finishedSessions),
		[state, finishedSessions]
	);
	const progressById = useMemo(() => new Map(progress.map((p) => [p.id, p])), [progress]);

	const ids = ACHIEVEMENT_IDS.filter(
		(id) => filter === 'all' || achievementCategory(id) === filter
	);

	return (
		<View style={styles.root}>
			{showFilters ? (
				<View style={styles.chips}>
					{FILTERS.map((f) => (
						<Chip
							key={f}
							label={tt(`achievements.filter.${f}`)}
							selected={filter === f}
							onPress={() => setFilter(f)}
						/>
					))}
				</View>
			) : null}
			<View style={styles.list}>
				{ids.map((id) => {
					const unlocked = isUnlocked(state, id);
					const isNew = highlight.has(id);
					const prog = progressById.get(id);
					const showBar =
						prog && prog.target > 1 && !unlocked && achievementCategory(id) === 'routine';
					return (
						<View
							key={id}
							style={[styles.row, unlocked && styles.rowOn, isNew && styles.rowNew]}
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
								{showBar && prog ? (
									<View style={styles.barTrack}>
										<View
											style={[
												styles.barFill,
												{
													width: `${Math.round((prog.current / prog.target) * 100)}%`
												}
											]}
										/>
									</View>
								) : null}
								{showBar && prog ? (
									<Text style={styles.progressMeta}>
										{prog.current}/{prog.target}
									</Text>
								) : null}
							</View>
						</View>
					);
				})}
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: { gap: space.sm },
		chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
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
		hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
		barTrack: {
			height: 6,
			borderRadius: radius.sm,
			backgroundColor: colors.border,
			marginTop: space.xs,
			overflow: 'hidden'
		},
		barFill: { height: '100%', backgroundColor: colors.accent },
		progressMeta: {
			color: colors.muted,
			fontSize: 12,
			fontWeight: '600',
			marginTop: 2,
			fontVariant: ['tabular-nums']
		}
	});
}
