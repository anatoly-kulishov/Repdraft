import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
	LIVE_REPS_NUDGE,
	LIVE_WEIGHT_NUDGE_KG
} from '@repdraft/domain/inputLimits';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, touchMin, type ColorPalette } from '../theme';
import { PrimaryButton } from './PrimaryButton';

export type SetDraft = { weight: string; reps: string };

export type SetPrev = { weightKg: number | null; reps: number | null } | null;

type Props = {
	setIndex: number;
	setCount: number;
	completed: boolean;
	current: boolean;
	skipLift: boolean;
	bodyweight: boolean;
	canRemove: boolean;
	kindLabel: string;
	draft: SetDraft;
	prev: SetPrev;
	onChangeWeight: (value: string) => void;
	onChangeReps: (value: string) => void;
	onBlur: () => void;
	onNudgeWeight: (delta: number) => void;
	onNudgeReps: (delta: number) => void;
	onApplyLast: () => void;
	onToggleKind: () => void;
	onToggleComplete: () => void;
	onRemove: () => void;
};

function formatPrev(prev: SetPrev): string | null {
	if (!prev || (prev.weightKg == null && prev.reps == null)) return null;
	if (prev.weightKg != null && prev.reps != null) return `${prev.weightKg} × ${prev.reps}`;
	if (prev.reps != null) return String(prev.reps);
	return String(prev.weightKg);
}

function LiveSetRowInner({
	setIndex,
	setCount,
	completed,
	current,
	skipLift,
	bodyweight,
	canRemove,
	kindLabel,
	draft,
	prev,
	onChangeWeight,
	onChangeReps,
	onBlur,
	onNudgeWeight,
	onNudgeReps,
	onApplyLast,
	onToggleKind,
	onToggleComplete,
	onRemove
}: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const n = setIndex + 1;
	const prevLabel = formatPrev(prev);
	const prevWeight = prev?.weightKg != null ? String(prev.weightKg) : '';
	const prevReps = prev?.reps != null ? String(prev.reps) : '';
	const canApply =
		!completed &&
		!skipLift &&
		prevLabel != null &&
		(draft.weight !== prevWeight || draft.reps !== prevReps);

	return (
		<View style={[styles.row, completed && styles.rowDone, current && styles.rowCurrent]}>
			<View style={styles.head}>
				<Text style={styles.index}>
					{tt('live.setProgress', { current: n, total: setCount })}
				</Text>
				{canApply ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={tt('live.lastApplyAria', { value: prevLabel ?? '' })}
						onPress={onApplyLast}
						style={styles.lastChip}
					>
						<Text style={styles.lastChipText} numberOfLines={1}>
							{tt('live.last')} {prevLabel}
						</Text>
					</Pressable>
				) : (
					<Text style={styles.prev} numberOfLines={1}>
						{tt('live.last')}: {prevLabel ?? '-'}
					</Text>
				)}
			</View>

			{skipLift ? null : (
				<View style={styles.fields}>
					{bodyweight ? <Text style={styles.bw}>{tt('live.weightBw')}</Text> : null}
					<View style={styles.step}>
						{completed ? null : (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={tt('live.nudgeWeightDown', { n })}
								onPress={() => onNudgeWeight(-LIVE_WEIGHT_NUDGE_KG)}
								style={styles.nudge}
							>
								<Text style={styles.nudgeText}>-</Text>
							</Pressable>
						)}
						<TextInput
							value={draft.weight}
							editable={!completed}
							onChangeText={onChangeWeight}
							onBlur={onBlur}
							keyboardType="decimal-pad"
							style={[styles.input, current && styles.inputCurrent]}
							placeholder={bodyweight ? tt('live.weightBwPh') : tt('common.kg')}
							placeholderTextColor={colors.muted}
							accessibilityLabel={`${tt(bodyweight ? 'live.weightBw' : 'live.weight')} ${n}`}
						/>
						{completed ? null : (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={tt('live.nudgeWeightUp', { n })}
								onPress={() => onNudgeWeight(LIVE_WEIGHT_NUDGE_KG)}
								style={styles.nudge}
							>
								<Text style={styles.nudgeText}>+</Text>
							</Pressable>
						)}
					</View>
					<View style={styles.step}>
						{completed ? null : (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={tt('live.nudgeRepsDown', { n })}
								onPress={() => onNudgeReps(-LIVE_REPS_NUDGE)}
								style={styles.nudge}
							>
								<Text style={styles.nudgeText}>-</Text>
							</Pressable>
						)}
						<TextInput
							value={draft.reps}
							editable={!completed}
							onChangeText={onChangeReps}
							onBlur={onBlur}
							keyboardType="number-pad"
							style={[styles.input, current && styles.inputCurrent]}
							placeholder={tt('common.reps')}
							placeholderTextColor={colors.muted}
							accessibilityLabel={`${tt('live.reps')} ${n}`}
						/>
						{completed ? null : (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={tt('live.nudgeRepsUp', { n })}
								onPress={() => onNudgeReps(LIVE_REPS_NUDGE)}
								style={styles.nudge}
							>
								<Text style={styles.nudgeText}>+</Text>
							</Pressable>
						)}
					</View>
					{bodyweight && current ? (
						<Text style={styles.bwHint}>{tt('live.weightBwHintShort')}</Text>
					) : null}
				</View>
			)}

			<View style={styles.actions}>
				<PrimaryButton label={kindLabel} variant="ghost" onPress={onToggleKind} />
				<PrimaryButton
					label={completed ? tt('live.undoSet') : tt('live.log')}
					onPress={onToggleComplete}
				/>
				{canRemove ? (
					<PrimaryButton label={tt('live.removeSet')} variant="ghost" onPress={onRemove} />
				) : null}
			</View>
		</View>
	);
}

export const LiveSetRow = memo(LiveSetRowInner);

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		row: {
			gap: space.sm,
			paddingVertical: space.md,
			borderTopWidth: 1,
			borderTopColor: colors.border
		},
		rowDone: { opacity: 0.72 },
		rowCurrent: {
			borderWidth: 1,
			borderColor: colors.accent,
			borderRadius: radius.md,
			paddingHorizontal: space.sm,
			borderTopColor: colors.accent
		},
		head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
		index: { color: colors.text, fontWeight: '700' },
		prev: { color: colors.muted, fontSize: 13, flexShrink: 1, textAlign: 'right' },
		lastChip: {
			minHeight: touchMin,
			minWidth: touchMin,
			justifyContent: 'center',
			paddingHorizontal: space.sm,
			borderRadius: radius.pill,
			borderWidth: 1,
			borderColor: colors.accent,
			flexShrink: 1
		},
		lastChipText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
		fields: { gap: space.sm },
		bw: { color: colors.muted, fontSize: 13, fontWeight: '600' },
		bwHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
		step: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
		nudge: {
			width: touchMin,
			height: touchMin,
			minWidth: touchMin,
			minHeight: touchMin,
			alignItems: 'center',
			justifyContent: 'center',
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			backgroundColor: colors.panel
		},
		nudgeText: { color: colors.text, fontSize: 22, fontWeight: '700' },
		input: {
			flex: 1,
			minHeight: 56,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			backgroundColor: colors.bg,
			color: colors.text,
			paddingHorizontal: space.md,
			fontSize: 22,
			fontWeight: '800',
			textAlign: 'center',
			fontVariant: ['tabular-nums']
		},
		inputCurrent: { borderColor: colors.accent },
		actions: { gap: space.sm }
	});
}
