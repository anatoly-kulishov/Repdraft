import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { formatKgInt } from '@repdraft/domain/format';
import type { Progress30d } from '@repdraft/domain/progressOverview';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	monthly: Progress30d;
	onOpen: () => void;
};

/** 30-day summary cards (workouts + volume) with week-over-week deltas. */
export function HomeProgressCards({ monthly, onOpen }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	const workoutsDelta =
		monthly.workoutsDeltaWeek === 0
			? tt('progress.deltaNone')
			: tt('progress.deltaWorkouts', {
					sign: monthly.workoutsDeltaWeek > 0 ? '+' : '',
					n: monthly.workoutsDeltaWeek,
					p: tt('progress.periodPastWeek')
				});
	const volumeDelta =
		monthly.volumeDeltaWeek === 0
			? tt('progress.deltaNone')
			: tt('progress.deltaVolume', {
					sign: monthly.volumeDeltaWeek > 0 ? '+' : '',
					n: formatKgInt(monthly.volumeDeltaWeek)
				});

	return (
		<View style={styles.section}>
			<View style={styles.sectionHead}>
				<Text style={styles.sectionTitle}>{tt('home.progress30Title')}</Text>
				<Pressable
					accessibilityRole="button"
					style={styles.sectionLink}
					onPress={onOpen}
				>
					<Text style={styles.sectionLinkText}>{tt('home.progressOpen')}</Text>
					<ChevronRight color={colors.mutedSoft} size={16} strokeWidth={2.25} />
				</Pressable>
			</View>
			<View style={styles.row}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={tt('nav.progress')}
					style={({ pressed }) => [styles.card, pressed && styles.pressed]}
					onPress={onOpen}
				>
					<Text style={styles.label}>{tt('progress.cardWorkouts')}</Text>
					<Text style={styles.value}>{monthly.workouts}</Text>
					<Text
						style={[
							styles.delta,
							monthly.workoutsDeltaWeek <= 0 && styles.deltaFlat
						]}
					>
						{workoutsDelta}
					</Text>
				</Pressable>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={tt('nav.progress')}
					style={({ pressed }) => [styles.card, pressed && styles.pressed]}
					onPress={onOpen}
				>
					<Text style={styles.label}>{tt('progress.cardVolume')}</Text>
					<Text style={styles.valueSm}>{formatKgInt(monthly.volumeKg)} кг</Text>
					<Text
						style={[styles.delta, monthly.volumeDeltaWeek <= 0 && styles.deltaFlat]}
					>
						{volumeDelta}
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		section: { gap: space.md },
		sectionHead: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			minHeight: touchMin
		},
		sectionTitle: {
			fontSize: 16,
			lineHeight: 22,
			fontWeight: '700',
			fontFamily: fontFamily.bold,
			color: colors.text
		},
		sectionLink: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 2,
			minHeight: touchMin,
			paddingHorizontal: space.sm
		},
		sectionLinkText: {
			fontSize: 14,
			lineHeight: 18,
			fontWeight: '500',
			fontFamily: fontFamily.medium,
			color: colors.mutedSoft
		},
		row: { flexDirection: 'row', gap: space.md },
		card: {
			flex: 1,
			gap: 2,
			minHeight: 96,
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			paddingHorizontal: space.lg,
			paddingVertical: space.lg,
			justifyContent: 'center'
		},
		label: {
			fontSize: 12,
			lineHeight: 16,
			fontWeight: '400',
			fontFamily: fontFamily.regular,
			color: colors.mutedSoft
		},
		value: {
			fontSize: 28,
			lineHeight: 34,
			fontWeight: '800',
			fontFamily: fontFamily.extrabold,
			color: colors.text
		},
		valueSm: {
			fontSize: 24,
			lineHeight: 30,
			fontWeight: '800',
			fontFamily: fontFamily.extrabold,
			color: colors.text
		},
		delta: {
			fontSize: 12,
			lineHeight: 16,
			fontWeight: '400',
			fontFamily: fontFamily.regular,
			color: colors.success
		},
		deltaFlat: { color: colors.mutedSoft },
		pressed: { opacity: 0.85 }
	});
}
