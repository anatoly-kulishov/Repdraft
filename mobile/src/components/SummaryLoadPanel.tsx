import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { labelCatalogZone } from '@repdraft/domain/catalogLinks';
import {
	WEEKLY_SETS_AIM,
	sessionSetsByBodyPart,
	setShares,
	weeklySetsByZone
} from '@repdraft/domain/trainingLoad';
import type { WorkoutSession } from '@repdraft/domain/types';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../theme';
import { Panel } from './Panel';

type Props = {
	session: WorkoutSession;
	allSessions: WorkoutSession[];
	bodyPartFor: (exerciseId: string) => string | null;
	onAddToPlan?: (bodyPart: string) => void;
};

type RowProps = {
	label: string;
	widthPct: number;
	value: string;
	styles: ReturnType<typeof makeStyles>;
	action?: { label: string; color: string; onPress: () => void };
};

function ShareRow({ label, widthPct, value, styles, action }: RowProps) {
	const content = (
		<>
			<Text style={styles.shareLabel} numberOfLines={1}>
				{label}
			</Text>
			<View style={styles.barTrack}>
				<View style={[styles.barFill, { width: `${widthPct}%` }]} />
			</View>
			<Text style={styles.shareValue}>{value}</Text>
			{action ? <Plus size={16} color={action.color} strokeWidth={2.25} /> : null}
		</>
	);

	if (!action) return <View style={styles.shareRow}>{content}</View>;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={action.label}
			onPress={action.onPress}
			style={({ pressed }) => [styles.shareRow, styles.shareRowAction, pressed && styles.pressed]}
		>
			{content}
		</Pressable>
	);
}

export function SummaryLoadPanel({ session, allSessions, bodyPartFor, onAddToPlan }: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	const { todayRows, todayMax, weekRows } = useMemo(() => {
		const rows = setShares(sessionSetsByBodyPart(session, bodyPartFor)).slice(0, 4);
		const sessions = allSessions.some((entry) => entry.id === session.id)
			? allSessions
			: [session, ...allSessions];
		return {
			todayRows: rows,
			todayMax: Math.max(1, ...rows.map((row) => row.sets)),
			weekRows: weeklySetsByZone(sessions, bodyPartFor).slice(0, 6)
		};
	}, [session, allSessions, bodyPartFor]);

	if (todayRows.length === 0 && weekRows.length === 0) return null;

	return (
		<Panel>
			{todayRows.length > 0 ? (
				<>
					<Text style={styles.sectionTitle}>{tt('summary.setsToday')}</Text>
					{todayRows.map((row) => (
						<ShareRow
							key={row.bodyPart}
							label={labelCatalogZone(row.bodyPart, locale)}
							widthPct={Math.max(6, Math.round((row.sets / todayMax) * 100))}
							value={`${row.sets}`}
							styles={styles}
						/>
					))}
				</>
			) : null}
			{weekRows.length > 0 ? (
				<>
					<View style={[styles.head, todayRows.length > 0 && styles.sectionGap]}>
						<Text style={styles.sectionTitleFlush}>{tt('summary.weekSets')}</Text>
						<Text style={styles.hint}>{tt('summary.weekSetsAim', { aim: WEEKLY_SETS_AIM })}</Text>
					</View>
					{weekRows.map((row) => {
						const part = labelCatalogZone(row.bodyPart, locale);
						return (
							<ShareRow
								key={row.bodyPart}
								label={part}
								widthPct={Math.min(
									100,
									Math.max(4, Math.round((row.sets / WEEKLY_SETS_AIM) * 100))
								)}
								value={`${row.sets} / ${WEEKLY_SETS_AIM}`}
								action={
									onAddToPlan && row.sets < WEEKLY_SETS_AIM
										? {
												label: tt('summary.addToPlanAria', { part }),
												color: colors.accent,
												onPress: () => onAddToPlan(row.bodyPart)
											}
										: undefined
								}
								styles={styles}
							/>
						);
					})}
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
		sectionTitleFlush: {
			color: colors.muted,
			fontWeight: '700',
			fontSize: 12,
			letterSpacing: 0.5,
			textTransform: 'uppercase',
			fontFamily: fontFamily.bold
		},
		head: {
			flexDirection: 'row',
			alignItems: 'baseline',
			justifyContent: 'space-between',
			gap: space.sm,
			marginBottom: space.sm
		},
		hint: {
			color: colors.muted,
			fontSize: 12,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		sectionGap: { marginTop: space.md },
		shareRow: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			marginBottom: space.xs
		},
		shareRowAction: {
			minHeight: 44,
			paddingHorizontal: space.xs,
			marginHorizontal: -space.xs,
			borderRadius: radius.sm
		},
		pressed: { opacity: 0.7 },
		shareLabel: {
			color: colors.text,
			fontSize: 14,
			fontWeight: '600',
			width: 80,
			fontFamily: fontFamily.semibold
		},
		barTrack: {
			flex: 1,
			height: 8,
			borderRadius: radius.sm,
			backgroundColor: colors.border,
			overflow: 'hidden'
		},
		barFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.sm },
		shareValue: {
			color: colors.muted,
			fontSize: 13,
			fontWeight: '600',
			width: 52,
			textAlign: 'right',
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.semibold
		}
	});
}
