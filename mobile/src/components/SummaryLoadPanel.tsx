import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { labelBodyPart } from '@repdraft/domain/labels.ru';
import {
	finishedSessionsWithinDays,
	laggingBodyParts,
	mergeVolumeMaps,
	sessionVolumeByBodyPart,
	volumeShares,
	type BodyPartShare
} from '@repdraft/domain/trainingLoad';
import type { WorkoutSession } from '@repdraft/domain/types';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../theme';
import { Panel } from './Panel';
import { PrimaryButton } from './PrimaryButton';

type Props = {
	session: WorkoutSession;
	allSessions: WorkoutSession[];
	bodyPartFor: (exerciseId: string) => string | null;
	onAddLagging?: (bodyPart: string) => void;
};

function ShareRow({
	row,
	colors,
	styles,
	label
}: {
	row: BodyPartShare;
	colors: ColorPalette;
	styles: ReturnType<typeof makeStyles>;
	label: string;
}) {
	return (
		<View style={styles.shareRow}>
			<Text style={styles.shareLabel} numberOfLines={1}>
				{label}
			</Text>
			<View style={styles.barTrack}>
				<View style={[styles.barFill, { width: `${Math.max(4, row.sharePct)}%` }]} />
			</View>
			<Text style={styles.sharePct}>{row.sharePct}%</Text>
		</View>
	);
}

export function SummaryLoadPanel({ session, allSessions, bodyPartFor, onAddLagging }: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	const { todayShares, lagging } = useMemo(() => {
		const todayMap = sessionVolumeByBodyPart(session, bodyPartFor);
		const recent = finishedSessionsWithinDays(
			allSessions.filter((s) => s.finishedAt),
			30
		);
		const windowMap = mergeVolumeMaps(
			recent.map((s) => sessionVolumeByBodyPart(s, bodyPartFor))
		);
		return {
			todayShares: volumeShares(todayMap).slice(0, 4),
			lagging: laggingBodyParts(todayMap, windowMap)
		};
	}, [session, allSessions, bodyPartFor]);

	if (todayShares.length === 0 && lagging.length === 0) return null;

	const lagRows = lagging.map((part) => ({
		part,
		label: labelBodyPart(part, locale)
	}));

	return (
		<Panel>
			{todayShares.length > 0 ? (
				<>
					<Text style={styles.sectionTitle}>{tt('summary.workedToday')}</Text>
					{todayShares.map((row) => (
						<ShareRow
							key={row.bodyPart}
							row={row}
							colors={colors}
							styles={styles}
							label={labelBodyPart(row.bodyPart, locale)}
						/>
					))}
				</>
			) : null}
			{lagRows.length > 0 ? (
				<>
					<Text style={[styles.sectionTitle, todayShares.length > 0 && styles.sectionGap]}>
						{tt('summary.lagging30d')}
					</Text>
					{lagRows.map(({ part, label }) => (
						<View key={part} style={styles.lagRow}>
							<Text style={styles.lagText}>{label}</Text>
							{onAddLagging ? (
								<PrimaryButton
									label={tt('summary.addToPlan')}
									variant="ghost"
									compact
									onPress={() => onAddLagging(part)}
								/>
							) : null}
						</View>
					))}
				</>
			) : null}
		</Panel>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		sectionTitle: {
			color: colors.muted,
			fontWeight: '700',
			fontSize: 12,
			letterSpacing: 0.5,
			textTransform: 'uppercase',
			marginBottom: space.sm,
			fontFamily: fontFamily.bold
		},
		sectionGap: { marginTop: space.md },
		shareRow: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			marginBottom: space.xs
		},
		shareLabel: { color: colors.text, fontSize: 14, fontWeight: '600', width: 88, fontFamily: fontFamily.semibold },
		barTrack: {
			flex: 1,
			height: 8,
			borderRadius: radius.sm,
			backgroundColor: colors.border,
			overflow: 'hidden'
		},
		barFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.sm },
		sharePct: {
			color: colors.muted,
			fontSize: 13,
			fontWeight: '600',
			width: 36,
			textAlign: 'right',
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.semibold
		},
		lagRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: space.sm,
			marginBottom: space.xs
		},
		lagText: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1, fontFamily: fontFamily.semibold }
	});
}
