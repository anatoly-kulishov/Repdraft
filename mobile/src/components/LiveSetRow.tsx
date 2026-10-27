import { Check, Trash2 } from 'lucide-react-native';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

export type SetDraft = { weight: string; reps: string };

export type SetPrev = { weightKg: number | null; reps: number | null } | null;

type Props = {
	setIndex: number;
	completed: boolean;
	current: boolean;
	skipLift: boolean;
	bodyweight: boolean;
	canRemove: boolean;
	showKindBadge: boolean;
	kindLabel: string;
	draft: SetDraft;
	prev: SetPrev;
	onChangeWeight: (value: string) => void;
	onChangeReps: (value: string) => void;
	onBlur: () => void;
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
	completed,
	current,
	skipLift,
	bodyweight,
	canRemove,
	showKindBadge,
	kindLabel,
	draft,
	prev,
	onChangeWeight,
	onChangeReps,
	onBlur,
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
		<View style={[styles.block, current && styles.blockCurrent, completed && styles.blockDone]}>
			<View style={styles.row}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={kindLabel}
					onPress={onToggleKind}
					style={styles.indexBtn}
				>
					<Text style={styles.index}>{n}</Text>
					{showKindBadge ? (
						<Text style={styles.kind} numberOfLines={1}>
							{kindLabel}
						</Text>
					) : null}
				</Pressable>
				{skipLift ? <View style={styles.fields} /> : (
					<View style={styles.fields}>
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
					</View>
				)}
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={completed ? tt('live.undoSet') : tt('live.log')}
					onPress={onToggleComplete}
					style={[
						styles.done,
						completed && styles.doneDone,
						current && !completed && styles.doneCurrent
					]}
				>
					<Check
						size={22}
						color={completed ? colors.accentInk : current ? colors.accentInk : colors.muted}
						strokeWidth={2.5}
					/>
				</Pressable>
				{canRemove ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={tt('live.removeSet')}
						onPress={onRemove}
						style={styles.remove}
					>
						<Trash2 size={18} color={colors.danger} strokeWidth={2.25} />
					</Pressable>
				) : null}
			</View>
			{canApply ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={tt('live.lastApplyAria', { value: prevLabel ?? '' })}
					onPress={onApplyLast}
					style={styles.last}
				>
					<Text style={styles.lastText} numberOfLines={1}>
						{tt('live.last')} {prevLabel}
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}

export const LiveSetRow = memo(LiveSetRowInner);

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		block: {
			gap: space.xs,
			paddingVertical: space.xs
		},
		blockCurrent: {},
		blockDone: {},
		row: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm
		},
		indexBtn: {
			width: touchMin,
			minHeight: touchMin,
			alignItems: 'center',
			justifyContent: 'center'
		},
		index: { color: colors.text, fontWeight: '800', fontSize: 17, fontFamily: fontFamily.extrabold },
		kind: { color: colors.muted, fontSize: 11, fontWeight: '700', fontFamily: fontFamily.bold },
		fields: { flex: 1, flexDirection: 'row', gap: space.sm, minWidth: 0 },
		input: {
			flex: 1,
			minWidth: 0,
			minHeight: touchMin,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			backgroundColor: colors.bg,
			color: colors.text,
			paddingHorizontal: space.sm,
			fontSize: 17,
			fontWeight: '700',
			textAlign: 'center',
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.bold
		},
		inputCurrent: { borderColor: colors.accent },
		done: {
			width: touchMin,
			height: touchMin,
			alignItems: 'center',
			justifyContent: 'center',
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			backgroundColor: colors.panel
		},
		doneDone: {
			backgroundColor: colors.accentFill,
			borderColor: colors.accentFill
		},
		doneCurrent: {
			backgroundColor: colors.accentFill,
			borderColor: colors.accentFill
		},
		remove: {
			width: touchMin,
			height: touchMin,
			alignItems: 'center',
			justifyContent: 'center'
		},
		last: {
			minHeight: touchMin,
			justifyContent: 'center',
			paddingHorizontal: space.sm
		},
		lastText: { color: colors.accent, fontWeight: '700', fontSize: 15, fontFamily: fontFamily.bold }
	});
}
