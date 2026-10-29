import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatKgInt } from '@repdraft/domain/format';
import type { ProgressCardMetrics } from '@repdraft/domain/progressOverview';
import { Panel } from '../components/Panel';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, space, type ColorPalette } from '../theme';

type Props = {
	cards: ProgressCardMetrics;
	workoutsDeltaText: string | null;
	volumeDeltaText: string | null;
};

/** Two metric cards: workouts + total volume with period deltas. */
export function ProgressMetricCards({ cards, workoutsDeltaText, volumeDeltaText }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<View style={styles.stats}>
			<Panel style={styles.stat}>
				<Text style={styles.label}>{tt('progress.cardWorkouts')}</Text>
				<Text style={styles.value}>{cards.workouts}</Text>
				{workoutsDeltaText != null ? (
					<Text
						style={[
							styles.delta,
							(cards.workoutsDelta ?? 0) === 0 && styles.deltaFlat,
							(cards.workoutsDelta ?? 0) < 0 && styles.deltaDown
						]}
					>
						{workoutsDeltaText}
					</Text>
				) : null}
			</Panel>
			<Panel style={styles.stat}>
				<Text style={styles.label}>{tt('progress.cardVolume')}</Text>
				<Text style={styles.valueKg}>
					{formatKgInt(cards.volumeKg)} {tt('pr.kg')}
				</Text>
				{volumeDeltaText != null ? (
					<Text
						style={[
							styles.delta,
							(cards.volumeKgDelta ?? 0) === 0 && styles.deltaFlat,
							(cards.volumeKgDelta ?? 0) < 0 && styles.deltaDown
						]}
					>
						{volumeDeltaText}
					</Text>
				) : null}
			</Panel>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		stats: { flexDirection: 'row', gap: space.md },
		stat: { flex: 1, gap: 2, paddingVertical: space.lg },
		label: {
			color: colors.mutedSoft,
			fontSize: 12,
			lineHeight: 16,
			fontFamily: fontFamily.regular
		},
		value: {
			color: colors.text,
			fontSize: 28,
			lineHeight: 34,
			fontWeight: '800',
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.extrabold
		},
		valueKg: {
			color: colors.text,
			fontSize: 24,
			lineHeight: 30,
			fontWeight: '800',
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.extrabold
		},
		delta: {
			color: colors.success,
			fontSize: 12,
			lineHeight: 16,
			fontFamily: fontFamily.regular
		},
		deltaFlat: { color: colors.mutedSoft },
		deltaDown: { color: colors.danger }
	});
}
