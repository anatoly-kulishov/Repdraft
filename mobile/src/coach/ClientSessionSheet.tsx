import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { coachSessionTotals, type CoachSessionDetail } from '@repdraft/domain/coach';
import { formatKgInt } from '@repdraft/domain/format';
import { loggedSetKind, setKindMessageKey } from '@repdraft/domain/session';
import { formatRelativeDayShort } from '@repdraft/i18n/format';
import { BottomSheet } from '../components/BottomSheet';
import { PrimaryButton } from '../components/PrimaryButton';
import { exerciseDisplayName } from '../catalog/loadIndex';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	open: boolean;
	detail: CoachSessionDetail | null;
	busy: boolean;
	onClose: () => void;
};

/** Read-only session detail the coach opens from a client row. */
export function ClientSessionSheet({ open, detail, busy, onClose }: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	function setLine(weightKg: number | null, reps: number | null): string {
		if (weightKg == null && reps == null) return tt('coach.sessionSetEmpty');
		return tt('coach.sessionSetLine', {
			weight: String(weightKg ?? tt('coach.sessionSetEmpty')),
			reps: String(reps ?? tt('coach.sessionSetEmpty'))
		});
	}

	const exercises = detail?.exercises.filter((ex) => !ex.skipped) ?? [];
	const totals = detail ? coachSessionTotals(detail) : null;
	const when = detail?.finishedAt ? formatRelativeDayShort(detail.finishedAt, locale) : null;

	return (
		<BottomSheet
			open={open}
			onDismiss={onClose}
			label={detail?.planName || tt('coach.sessionDetailTitle')}
			actions={
				<PrimaryButton label={tt('common.close')} variant="secondary" onPress={onClose} />
			}
		>
			<Text style={styles.title}>
				{detail?.planName?.trim() || tt('coach.sessionDetailTitle')}
			</Text>
			{when && totals ? (
				<Text style={styles.muted}>
					{totals.minutes != null
						? tt('coach.sessionSummary', {
								when,
								min: totals.minutes,
								sets: totals.sets,
								kg: formatKgInt(totals.volumeKg)
							})
						: tt('coach.sessionMeta', {
								when,
								sets: totals.sets,
								volume: formatKgInt(totals.volumeKg)
							})}
				</Text>
			) : null}
			{busy && !detail ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : null}
			{detail
				? exercises.map((ex, exIndex) => (
						<View key={`${ex.exerciseId}-${exIndex}`} style={styles.exBlock}>
							<Text style={styles.exTitle}>
								{exerciseDisplayName(ex.exerciseId, locale)}
							</Text>
							{(ex.targetSets > 0 || ex.targetReps > 0) && (
								<Text style={styles.muted}>
									{ex.targetSets}×{ex.targetReps}
								</Text>
							)}
							{ex.sets.map((set, i) => {
								const kind = loggedSetKind(set);
								return (
									<View key={i} style={[styles.setRow, !set.completed && styles.setOpen]}>
										<Text style={styles.setLine}>{setLine(set.weightKg, set.reps)}</Text>
										{kind !== 'work' ? (
											<Text style={styles.muted}>{tt(setKindMessageKey(kind))}</Text>
										) : null}
									</View>
								);
							})}
						</View>
					))
				: null}
			{detail && exercises.length === 0 ? (
				<Text style={styles.muted}>{tt('coach.sessionDetailEmpty')}</Text>
			) : null}
		</BottomSheet>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		title: {
			color: colors.text,
			fontSize: 20,
			fontWeight: '800',
			fontFamily: fontFamily.extrabold
		},
		muted: {
			color: colors.muted,
			fontSize: 14,
			fontFamily: fontFamily.regular,
			lineHeight: 20
		},
		loader: { marginTop: space.md },
		exBlock: { marginTop: space.md, gap: 4 },
		exTitle: {
			color: colors.text,
			fontSize: 15,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		setRow: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.border,
			paddingVertical: 6
		},
		setOpen: { opacity: 0.55 },
		setLine: {
			color: colors.text,
			fontSize: 14,
			fontFamily: fontFamily.regular,
			fontVariant: ['tabular-nums']
		}
	});
}
