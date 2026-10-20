import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { restSecondsLeft } from '../live/restUntil';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../theme';
import { PrimaryButton } from './PrimaryButton';

type Props = {
	restUntil: number;
	totalSec: number;
	onAdjust: (deltaSec: number) => void;
	onSkip: () => void;
	onDone: () => void;
};

/** Owns the 250ms tick. Mount only while a rest is active. */
export function RestTimer({ restUntil, totalSec, onAdjust, onSkip, onDone }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const [now, setNow] = useState(() => Date.now());
	const doneRef = useRef(false);

	useEffect(() => {
		doneRef.current = false;
	}, [restUntil]);

	useEffect(() => {
		const t = setInterval(() => setNow(Date.now()), 250);
		return () => clearInterval(t);
	}, []);

	const left = restSecondsLeft(restUntil, now);
	const pct = left > 0 ? Math.min(1, left / Math.max(1, totalSec)) : 0;

	useEffect(() => {
		if (left === 0 && !doneRef.current) {
			doneRef.current = true;
			onDone();
		}
	}, [left, onDone]);

	return (
		<View style={styles.restBox}>
			<View style={styles.restTopRow}>
				<Text style={styles.restLabel}>{tt('live.rest')}</Text>
				<View style={styles.restActions}>
					<PrimaryButton
						label={tt('live.restMinus30')}
						variant="ghost"
						compact
						onPress={() => onAdjust(-30)}
					/>
					<PrimaryButton
						label={tt('live.restPlus30')}
						variant="ghost"
						compact
						onPress={() => onAdjust(30)}
					/>
					<PrimaryButton
						label={tt('live.skipRest')}
						variant="ghost"
						compact
						onPress={onSkip}
					/>
				</View>
			</View>
			<View style={styles.restBottomRow}>
				<Text style={styles.restValue}>{left}</Text>
				<Text style={styles.restUnit}>{tt('live.restUnit')}</Text>
				<View style={styles.restBarTrack}>
					<View style={[styles.restBarFill, { width: `${Math.round(pct * 100)}%` }]} />
				</View>
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		restBox: {
			backgroundColor: colors.panelRaised,
			borderRadius: radius.md,
			padding: space.md,
			gap: space.sm,
			borderWidth: 1,
			borderColor: colors.accent
		},
		restTopRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: space.sm
		},
		restLabel: {
			color: colors.muted,
			fontWeight: '700',
			letterSpacing: 0.6,
			textTransform: 'uppercase',
			fontSize: 12,
			fontFamily: fontFamily.bold
		},
		restActions: { flexDirection: 'row', gap: 6 },
		restBottomRow: {
			flexDirection: 'row',
			alignItems: 'baseline',
			gap: space.xs
		},
		restValue: {
			color: colors.accent,
			fontSize: 30,
			fontWeight: '800',
			fontVariant: ['tabular-nums'],
			lineHeight: 34,
			minWidth: 40,
			textAlign: 'right',
			fontFamily: fontFamily.extrabold
		},
		restUnit: { color: colors.muted, fontWeight: '600', fontSize: 13, fontFamily: fontFamily.semibold },
		restBarTrack: {
			flex: 1,
			alignSelf: 'center',
			height: 6,
			borderRadius: 999,
			backgroundColor: colors.bg,
			overflow: 'hidden',
			marginLeft: space.sm
		},
		restBarFill: { height: '100%', backgroundColor: colors.accent }
	});
}
