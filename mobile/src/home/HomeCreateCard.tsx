import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	/** No plans and no finished sessions: the first-run copy, otherwise "no plans yet". */
	firstTime: boolean;
	onCreate: () => void;
};

/**
 * Home without plans used to be a dead end: only the "recent" placeholder text.
 * Web shows a create hero here, so the phone does the same (same copy keys).
 */
export function HomeCreateCard({ firstTime, onCreate }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const title = tt(firstTime ? 'home.welcomeTitle' : 'home.noPlansTitle');
	const lead = tt(firstTime ? 'home.welcomeLead' : 'home.noPlansLead');

	return (
		<View style={styles.card}>
			<Text style={styles.kicker}>{tt('home.planToday')}</Text>
			<Text style={styles.title}>{title}</Text>
			<Text style={styles.lead}>{lead}</Text>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={tt('workouts.create')}
				onPress={onCreate}
				style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
			>
				<Plus color={colors.accentInk} size={18} strokeWidth={2.5} />
				<Text style={styles.ctaText}>{tt('workouts.create')}</Text>
			</Pressable>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		card: {
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.lg,
			gap: space.sm
		},
		kicker: {
			color: colors.mutedSoft,
			fontSize: 12,
			lineHeight: 16,
			fontFamily: fontFamily.regular
		},
		title: {
			color: colors.text,
			fontSize: 22,
			lineHeight: 28,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		lead: {
			color: colors.muted,
			fontSize: 14,
			lineHeight: 20,
			fontFamily: fontFamily.regular
		},
		cta: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			gap: space.sm,
			minHeight: touchMin,
			marginTop: space.xs,
			paddingHorizontal: space.lg,
			borderRadius: radius.md,
			backgroundColor: colors.accentFill
		},
		ctaText: {
			color: colors.accentInk,
			fontSize: 16,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		pressed: { opacity: 0.85 }
	});
}
