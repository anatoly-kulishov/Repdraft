import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatKgInt } from '@repdraft/domain/format';
import type { WeekVolume } from '@repdraft/domain/progressOverview';
import { Panel } from '../components/Panel';
import { PrimaryButton } from '../components/PrimaryButton';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, space, type ColorPalette } from '../theme';
import { makeProgressPanelStyles } from './panelStyles';

type Props = {
	weeks: WeekVolume[];
	maxWeekVol: number;
	thisWeekKey: string;
	weekRange: (weekKey: string) => string;
	onEmptyCta: () => void;
};

export function WeeklyVolumePanel({
	weeks,
	maxWeekVol,
	thisWeekKey,
	weekRange,
	onEmptyCta
}: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<Panel>
			<Text style={styles.sectionTitle}>{tt('progress.barTitle')}</Text>
			{weeks.length === 0 ? (
				<>
					<Text style={styles.muted}>{tt('progress.empty')}</Text>
					<PrimaryButton label={tt('progress.emptyCta')} onPress={onEmptyCta} />
				</>
			) : (
				weeks.map((week) => {
					const isNow = week.weekKey === thisWeekKey;
					return (
						<View key={week.weekKey} style={styles.weekRow}>
							<Text style={[styles.weekLabel, isNow && styles.weekLabelNow]}>
								{weekRange(week.weekKey)}
							</Text>
							<View style={styles.barTrack}>
								<View
									style={[
										styles.barFill,
										{ width: `${Math.round((week.volumeKg / maxWeekVol) * 100)}%` }
									]}
								/>
							</View>
							<Text style={styles.weekMeta}>
								{tt('progress.barMeta', {
									kg: formatKgInt(week.volumeKg),
									n: week.workouts
								})}
							</Text>
						</View>
					);
				})
			)}
		</Panel>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		...makeProgressPanelStyles(colors),
		weekRow: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			paddingVertical: 4
		},
		weekLabel: {
			width: 80,
			color: colors.muted,
			fontSize: 12,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		weekLabelNow: { color: colors.accentText },
		weekMeta: {
			width: 96,
			textAlign: 'right',
			color: colors.muted,
			fontSize: 11,
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.regular
		}
	});
}
