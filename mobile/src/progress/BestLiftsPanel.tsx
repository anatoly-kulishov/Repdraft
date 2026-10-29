import { useMemo } from 'react';
import { Text, View } from 'react-native';
import type { ProgressBestLift, ProgressPeriod } from '@repdraft/domain/progressOverview';
import { exerciseDisplayName } from '../catalog/loadIndex';
import { Panel } from '../components/Panel';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { type ColorPalette } from '../theme';
import { makeProgressPanelStyles } from './panelStyles';

type Props = {
	lifts: ProgressBestLift[];
	period: ProgressPeriod;
	formatWeight: (kg: number) => string;
};

export function BestLiftsPanel({ lifts, period, formatWeight }: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	if (lifts.length === 0) return null;

	return (
		<Panel>
			<Text style={styles.sectionTitle}>
				{tt('progress.bestLiftsNew', { n: period === 'all' ? '∞' : period })}
			</Text>
			<Text style={styles.panelHint}>{tt('progress.bestLiftsHintNew')}</Text>
			{lifts.map((lift) => (
				<View key={lift.exerciseId} style={styles.row}>
					<Text style={styles.rowName} numberOfLines={1}>
						{exerciseDisplayName(lift.exerciseId, locale)}
					</Text>
					<Text style={styles.rowValue}>
						{formatWeight(lift.weightKg)} {tt('pr.kg')} × {lift.reps} {tt('pr.repsShort')}
					</Text>
				</View>
			))}
		</Panel>
	);
}

function makeStyles(colors: ColorPalette) {
	return makeProgressPanelStyles(colors);
}
