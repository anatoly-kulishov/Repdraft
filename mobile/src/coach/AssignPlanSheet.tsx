import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CoachAssignablePlan } from '@repdraft/domain/coach';
import { BottomSheet } from '../components/BottomSheet';
import { PrimaryButton } from '../components/PrimaryButton';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	open: boolean;
	clientLabel: string;
	loading: boolean;
	busy: boolean;
	plans: CoachAssignablePlan[];
	onPick: (plan: CoachAssignablePlan) => void;
	onDismiss: () => void;
};

/** Plan picker for "assign a workout" (web `CoachAssignSheet` twin). */
export function AssignPlanSheet({ open, clientLabel, loading, busy, plans, onPick, onDismiss }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<BottomSheet
			open={open}
			onDismiss={onDismiss}
			dismissible={!busy}
			label={tt('coach.assignTitle')}
			actions={
				<PrimaryButton
					label={tt('common.cancel')}
					variant="secondary"
					onPress={onDismiss}
					disabled={busy}
				/>
			}
		>
			<Text style={styles.title}>{tt('coach.assignTitle')}</Text>
			<Text style={styles.hint}>
				{clientLabel} · {tt('coach.assignHint')}
			</Text>

			{loading ? (
				<View style={styles.loading}>
					<ActivityIndicator color={colors.accentText} />
				</View>
			) : plans.length === 0 ? (
				<Text style={styles.muted}>{tt('coach.assignEmpty')}</Text>
			) : (
				<ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
					{plans.map((plan) => (
						<Pressable
							key={plan.planId}
							accessibilityRole="button"
							disabled={busy}
							style={({ pressed }) => [styles.row, pressed && styles.pressed]}
							onPress={() => onPick(plan)}
						>
							<Text style={styles.rowName} numberOfLines={1}>
								{plan.name}
							</Text>
							<Text style={styles.rowMeta}>
								{tt('coach.assignExercises', { n: plan.exerciseCount })}
							</Text>
						</Pressable>
					))}
				</ScrollView>
			)}
		</BottomSheet>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		title: {
			fontSize: 17,
			fontWeight: '700',
			fontFamily: fontFamily.bold,
			color: colors.text
		},
		hint: { marginTop: space.xs, fontSize: 13, lineHeight: 19, color: colors.muted },
		muted: { marginTop: space.md, fontSize: 13, lineHeight: 19, color: colors.muted },
		loading: { paddingVertical: space.xl, alignItems: 'center' },
		list: { marginTop: space.md, maxHeight: 320 },
		listContent: { gap: space.sm },
		row: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: space.md,
			paddingVertical: space.md,
			paddingHorizontal: space.md,
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: radius.md,
			backgroundColor: colors.panel
		},
		rowName: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '600', color: colors.text },
		rowMeta: { fontSize: 13, color: colors.muted },
		pressed: { opacity: 0.85 }
	});
}
