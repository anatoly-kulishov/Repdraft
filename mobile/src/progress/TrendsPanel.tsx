import { useMemo } from 'react';
import { Text, View } from 'react-native';
import type { ExerciseTrend, ProgressPeriod } from '@repdraft/domain/progressOverview';
import { exerciseDisplayName } from '../catalog/loadIndex';
import { Panel } from '../components/Panel';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { type ColorPalette } from '../theme';
import { makeProgressPanelStyles } from './panelStyles';

type Props = {
	trends: ExerciseTrend[];
	period: ProgressPeriod;
	trendSigned: (deltaKg: number) => string;
};

export function TrendsPanel({ trends, period, trendSigned }: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	if (trends.length === 0) return null;

	return (
		<Panel>
			<Text style={styles.sectionTitle}>{tt('progress.trendsNew')}</Text>
			<Text style={styles.panelHint}>
				{tt('progress.trendsHintNew', { n: period === 'all' ? 30 : period })}
			</Text>
			{trends.map((row) => (
				<View key={row.exerciseId} style={styles.row}>
					<Text style={styles.rowName} numberOfLines={1}>
						{exerciseDisplayName(row.exerciseId, locale)}
					</Text>
					<View style={[styles.pill, row.deltaKg > 0 ? styles.pillUp : styles.pillDown]}>
						<Text
							style={[
								styles.pillText,
								row.deltaKg > 0 ? styles.pillTextUp : styles.pillTextDown
							]}
						>
							{trendSigned(row.deltaKg)}
						</Text>
					</View>
				</View>
			))}
		</Panel>
	);
}

function makeStyles(colors: ColorPalette) {
	return makeProgressPanelStyles(colors);
}
