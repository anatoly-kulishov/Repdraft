import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { PeriodTabs } from '../src/progress/PeriodTabs';
import { ProgressMetricCards } from '../src/progress/ProgressMetricCards';
import { BestLiftsPanel } from '../src/progress/BestLiftsPanel';
import { SharesPanel } from '../src/progress/SharesPanel';
import { TrendsPanel } from '../src/progress/TrendsPanel';
import { WeeklyVolumePanel } from '../src/progress/WeeklyVolumePanel';
import { useProgressScreen } from '../src/progress/useProgressScreen';
import { useBottomChromePad } from '../src/layout/safe';
import { useLocale } from '../src/state/locale';
import { useAppColors } from '../src/state/theme';
import { fontFamily, space, type ColorPalette } from '../src/theme';

export default function ProgressScreen() {
	const router = useRouter();
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const progress = useProgressScreen();

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<Text style={styles.lead}>{tt('progress.lead')}</Text>
			<PeriodTabs period={progress.period} onChange={progress.setPeriod} />
			<ProgressMetricCards
				cards={progress.overview.cards}
				workoutsDeltaText={progress.workoutsDeltaText()}
				volumeDeltaText={progress.volumeDeltaText()}
			/>
			<WeeklyVolumePanel
				weeks={progress.overview.weeks}
				maxWeekVol={progress.maxWeekVol}
				thisWeekKey={progress.overview.streak.thisWeekKey}
				weekRange={progress.weekRange}
				onEmptyCta={() => router.push('/')}
			/>
			<SharesPanel
				shares={progress.overview.setShares}
				laggingPart={progress.laggingPart}
			/>
			<BestLiftsPanel
				lifts={progress.overview.bestLifts}
				period={progress.period}
				formatWeight={progress.formatWeight}
			/>
			<TrendsPanel
				trends={progress.overview.trends}
				period={progress.period}
				trendSigned={progress.trendSigned}
			/>
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: space.lg },
		lead: {
			color: colors.muted,
			fontSize: 14,
			lineHeight: 20,
			fontFamily: fontFamily.regular
		}
	});
}
