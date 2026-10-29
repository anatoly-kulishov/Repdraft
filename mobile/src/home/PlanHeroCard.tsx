import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Play } from 'lucide-react-native';
import { translatePlural } from '@repdraft/i18n/messages';
import type { WorkoutPlan, WorkoutSession } from '@repdraft/domain/types';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

type HeroMeta = {
	exercises: number;
	minutes: number;
	summary: string;
};

type Props = {
	active: WorkoutSession | null;
	continueMeta: string | null;
	next: WorkoutPlan | null;
	heroMeta: HeroMeta | null;
	onContinue: (planId: string) => void;
	onOpenPlan: (planId: string) => void;
};

/** Primary home CTA: active session first, otherwise today's plan. */
export function PlanHeroCard({
	active,
	continueMeta,
	next,
	heroMeta,
	onContinue,
	onOpenPlan
}: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	if (active && continueMeta) {
		const planId = active.planId ?? 'active';
		return (
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={tt('home.continueWorkout')}
				onPress={() => onContinue(planId)}
				style={({ pressed }) => [styles.card, pressed && styles.pressed]}
			>
				<View style={styles.row}>
					<View style={styles.body}>
						<Text style={styles.kicker}>{tt('home.workoutInProgress')}</Text>
						<Text style={styles.title} numberOfLines={2}>
							{active.planName || '-'}
						</Text>
						<View style={styles.pills}>
							<Pill label={continueMeta} />
						</View>
					</View>
					<HeroFab
						onPress={() => onContinue(planId)}
						colors={colors}
						label={tt('home.continue')}
					/>
				</View>
			</Pressable>
		);
	}

	if (!next || !heroMeta) return null;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={tt('home.startWorkoutNamed', { name: next.name })}
			onPress={() => onOpenPlan(next.id)}
			style={({ pressed }) => [styles.card, pressed && styles.pressed]}
		>
			<View style={styles.row}>
				<View style={styles.body}>
					<Text style={styles.kicker}>{tt('home.planToday')}</Text>
					<Text style={styles.title} numberOfLines={2}>
						{next.name || '-'}
					</Text>
					<View style={styles.pills}>
						<Pill
							label={translatePlural(locale, 'home.pillExercises', heroMeta.exercises)}
						/>
						{heroMeta.minutes > 0 ? (
							<Pill label={tt('home.pillMinutes', { n: heroMeta.minutes })} />
						) : null}
						{heroMeta.summary ? <Pill label={heroMeta.summary} accent /> : null}
					</View>
				</View>
				<HeroFab onPress={() => onOpenPlan(next.id)} colors={colors} label={tt('home.begin')} />
			</View>
		</Pressable>
	);
}

function Pill({ label, accent }: { label: string; accent?: boolean }) {
	const colors = useAppColors();
	const styles = useMemo(() => pillStyles(colors), [colors]);
	return (
		<View style={[styles.pill, accent && styles.pillAccent]}>
			<Text style={[styles.text, accent && styles.textAccent]} numberOfLines={1}>
				{label}
			</Text>
		</View>
	);
}

function HeroFab({
	onPress,
	colors,
	label
}: {
	onPress: () => void;
	colors: ColorPalette;
	label: string;
}) {
	const styles = useMemo(() => fabStyles(colors), [colors]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			hitSlop={4}
			style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
		>
			<View style={styles.orb}>
				<Play color={colors.accentInk} size={22} fill={colors.accentInk} strokeWidth={0} />
			</View>
			<Text style={styles.label} numberOfLines={1}>
				{label}
			</Text>
		</Pressable>
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
		row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
		body: { flex: 1, gap: space.sm },
		kicker: {
			fontSize: 12,
			lineHeight: 16,
			fontWeight: '400',
			fontFamily: fontFamily.regular,
			color: colors.mutedSoft
		},
		title: {
			color: colors.text,
			fontSize: 22,
			lineHeight: 28,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
		pressed: { opacity: 0.85 }
	});
}

function pillStyles(colors: ColorPalette) {
	return StyleSheet.create({
		pill: {
			borderRadius: radius.tag,
			backgroundColor: colors.panelRaised,
			paddingHorizontal: space.sm,
			paddingVertical: 4
		},
		pillAccent: { backgroundColor: colors.accentDim },
		text: {
			fontSize: 12,
			lineHeight: 16,
			fontWeight: '500',
			fontFamily: fontFamily.medium,
			color: colors.text
		},
		textAccent: { color: colors.secondary }
	});
}

function fabStyles(colors: ColorPalette) {
	return StyleSheet.create({
		wrap: {
			alignItems: 'center',
			justifyContent: 'center',
			gap: 6,
			minWidth: 64,
			minHeight: touchMin
		},
		orb: {
			width: 52,
			height: 52,
			borderRadius: 26,
			backgroundColor: colors.accentFill,
			alignItems: 'center',
			justifyContent: 'center',
			paddingLeft: 3,
			shadowColor: colors.accent,
			shadowOpacity: 0.32,
			shadowRadius: 12,
			shadowOffset: { width: 0, height: 4 },
			elevation: 5
		},
		label: {
			color: colors.accentText,
			fontSize: 12,
			lineHeight: 16,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		pressed: { opacity: 0.85 }
	});
}
