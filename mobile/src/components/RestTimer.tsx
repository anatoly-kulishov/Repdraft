import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { restSecondsLeft } from '../live/restUntil';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, type ColorPalette } from '../theme';
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
			<Text style={styles.restLabel}>{tt('live.rest')}</Text>
			<Text style={styles.restValue}>{left}</Text>
			<Text style={styles.restUnit}>sec</Text>
			<View style={styles.restBarTrack}>
				<View style={[styles.restBarFill, { width: `${Math.round(pct * 100)}%` }]} />
			</View>
			<View style={styles.restActions}>
				<View style={styles.restAction}>
					<PrimaryButton
						label={tt('live.restMinus30')}
						variant="ghost"
						compact
						onPress={() => onAdjust(-30)}
					/>
				</View>
				<View style={styles.restAction}>
					<PrimaryButton
						label={tt('live.restPlus30')}
						variant="ghost"
						compact
						onPress={() => onAdjust(30)}
					/>
				</View>
				<View style={styles.restAction}>
					<PrimaryButton label={tt('live.skipRest')} variant="ghost" compact onPress={onSkip} />
				</View>
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		restBox: {
			backgroundColor: colors.panelRaised,
			borderRadius: radius.lg,
			padding: space.lg,
			alignItems: 'center',
			gap: space.sm,
			borderWidth: 1,
			borderColor: colors.accent
		},
		restLabel: {
			color: colors.muted,
			fontWeight: '700',
			letterSpacing: 0.6,
			textTransform: 'uppercase',
			fontSize: 12
		},
		restValue: {
			color: colors.accent,
			fontSize: 48,
			fontWeight: '800',
			fontVariant: ['tabular-nums'],
			lineHeight: 52
		},
		restUnit: { color: colors.muted, fontWeight: '600', marginTop: -6 },
		restBarTrack: {
			alignSelf: 'stretch',
			height: 8,
			borderRadius: 999,
			backgroundColor: colors.bg,
			overflow: 'hidden',
			marginTop: space.xs
		},
		restBarFill: { height: '100%', backgroundColor: colors.accent },
		restActions: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch', marginTop: space.sm },
		restAction: { flex: 1 }
	});
}
