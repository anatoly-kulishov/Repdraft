import { Check, Timer, Trash2 } from 'lucide-react-native';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

export type SetDraft = { weight: string; reps: string };

type Props = {
	setIndex: number;
	completed: boolean;
	current: boolean;
	skipLift: boolean;
	bodyweight: boolean;
	/** Hold (plank): the rep field is seconds and gets a stopwatch. */
	timed: boolean;
	/** Steady cardio: the timed field counts minutes, not seconds. */
	minutes: boolean;
	timerRunning: boolean;
	/** Elapsed mm:ss while the stopwatch runs. */
	timerLabel: string;
	onToggleTimer: () => void;
	canRemove: boolean;
	showKindBadge: boolean;
	kindLabel: string;
	draft: SetDraft;
	onChangeWeight: (value: string) => void;
	onChangeReps: (value: string) => void;
	onBlur: () => void;
	onToggleKind: () => void;
	onToggleComplete: () => void;
	onRemove: () => void;
};

function LiveSetRowInner({
	setIndex,
	completed,
	current,
	skipLift,
	bodyweight,
	timed,
	minutes,
	timerRunning,
	timerLabel,
	onToggleTimer,
	canRemove,
	showKindBadge,
	kindLabel,
	draft,
	onChangeWeight,
	onChangeReps,
	onBlur,
	onToggleKind,
	onToggleComplete,
	onRemove
}: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const n = setIndex + 1;

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
				{skipLift && !timed ? <View style={styles.fields} /> : (
					<View style={styles.fields}>
						{timed ? null : (
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
						)}
						<TextInput
							value={draft.reps}
							editable={!completed}
							onChangeText={onChangeReps}
							onBlur={onBlur}
							keyboardType="number-pad"
							style={[styles.input, current && styles.inputCurrent]}
							placeholder={
								minutes
									? tt('live.minutesPh')
									: timed
										? tt('live.secondsPh')
										: tt('common.reps')
							}
							placeholderTextColor={colors.muted}
							accessibilityLabel={`${tt(minutes ? 'live.minutes' : timed ? 'live.seconds' : 'live.reps')} ${n}`}
						/>
						{timed && !completed ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={timerRunning ? tt('live.timerStop') : tt('live.timerStart')}
								onPress={onToggleTimer}
								style={[styles.timer, timerRunning && styles.timerRunning]}
							>
								{timerRunning ? (
									<Text style={styles.timerText}>{timerLabel}</Text>
								) : (
									<Timer size={22} color={colors.muted} strokeWidth={2.25} />
								)}
							</Pressable>
						) : null}
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
		timer: {
			width: touchMin,
			minWidth: touchMin,
			height: touchMin,
			alignItems: 'center',
			justifyContent: 'center',
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			backgroundColor: colors.panel
		},
		timerRunning: { borderColor: colors.accentFill, backgroundColor: colors.accentFill },
		timerText: {
			color: colors.accentInk,
			fontSize: 14,
			fontWeight: '800',
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.bold
		},
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
		}
	});
}
