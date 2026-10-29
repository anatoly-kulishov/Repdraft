import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PROGRESS_PERIODS, type ProgressPeriod } from '@repdraft/domain/progressOverview';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, type ColorPalette } from '../theme';

type Props = {
	period: ProgressPeriod;
	onChange: (period: ProgressPeriod) => void;
};

/** 7 / 30 / 90 / all segmented control from the progress UI kit. */
export function PeriodTabs({ period, onChange }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<View style={styles.tabs} accessibilityRole="tablist">
			{PROGRESS_PERIODS.map((value) => {
				const active = period === value;
				return (
					<Pressable
						key={value}
						accessibilityRole="tab"
						accessibilityState={{ selected: active }}
						onPress={() => onChange(value)}
						style={({ pressed }) => [
							styles.tab,
							active && styles.tabActive,
							pressed && styles.pressed
						]}
					>
						<Text style={[styles.tabText, active && styles.tabTextActive]}>
							{tt(`progress.period.${value}`)}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		tabs: {
			flexDirection: 'row',
			gap: 4,
			padding: 4,
			borderRadius: radius.md,
			backgroundColor: colors.panelRaised
		},
		tab: {
			flex: 1,
			minHeight: 40,
			borderRadius: radius.control,
			alignItems: 'center',
			justifyContent: 'center',
			paddingHorizontal: 2
		},
		tabActive: { backgroundColor: colors.accentFill },
		tabText: {
			color: colors.muted,
			fontSize: 13,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		tabTextActive: { color: colors.accentInk },
		pressed: { opacity: 0.85 }
	});
}
