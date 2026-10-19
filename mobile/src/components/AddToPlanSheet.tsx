import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { WorkoutPlan } from '@repdraft/domain/types';
import { BottomSheet } from './BottomSheet';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	open: boolean;
	plans: readonly WorkoutPlan[];
	onCreate: () => void;
	onPick: (planId: string) => void;
	onDismiss: () => void;
};

/** Plan picker. Twin of web bottom-sheet action rows, not the system action sheet. */
export function AddToPlanSheet({ open, plans, onCreate, onPick, onDismiss }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const title = tt('exercises.add');

	return (
		<BottomSheet open={open} onDismiss={onDismiss} label={title}>
			<Text style={styles.title}>{title}</Text>
			<ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
				<Pressable
					accessibilityRole="button"
					style={({ pressed }) => [styles.row, pressed && styles.pressed]}
					onPress={onCreate}
				>
					<Text style={styles.label}>{tt('workouts.create')}</Text>
				</Pressable>
				{plans.map((plan) => (
					<Pressable
						key={plan.id}
						accessibilityRole="button"
						style={({ pressed }) => [styles.row, pressed && styles.pressed]}
						onPress={() => onPick(plan.id)}
					>
						<Text style={styles.label} numberOfLines={1}>
							{plan.name || tt('workouts.newName')}
						</Text>
						<Text style={styles.meta}>{tt('workouts.exCount', { n: plan.exercises.length })}</Text>
					</Pressable>
				))}
			</ScrollView>
		</BottomSheet>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		title: {
			color: colors.text,
			fontSize: 18,
			lineHeight: 24,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		scroll: { maxHeight: 420 },
		row: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			paddingHorizontal: space.sm,
			borderRadius: radius.sm
		},
		pressed: { backgroundColor: colors.panelRaised },
		label: {
			flex: 1,
			color: colors.text,
			fontSize: 15,
			lineHeight: 20,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		meta: {
			color: colors.muted,
			fontSize: 14,
			lineHeight: 18,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		}
	});
}
