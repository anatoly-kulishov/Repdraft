import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeProgressOverview } from '@repdraft/domain/progressOverview';
import type { WorkoutSession } from '@repdraft/domain/types';
import { Panel } from '../../src/components/Panel';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useTabScreenPad } from '../../src/layout/safe';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { radius, space, type ColorPalette } from '../../src/theme';

export default function ProgressScreen() {
	const router = useRouter();
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const tabPad = useTabScreenPad(space.lg);
	const [sessions, setSessions] = useState<WorkoutSession[]>([]);

	useFocusEffect(
		useCallback(() => {
			void sessionsRepo.list().then(setSessions);
		}, [])
	);

	const overview = useMemo(() => computeProgressOverview(sessions), [sessions]);
	const maxWeekVol = Math.max(1, ...overview.weeks.map((w) => w.volumeKg));

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: tabPad }]}
		>
			<Text style={styles.lead}>{tt('progress.lead')}</Text>
			<View style={styles.stats}>
				<View style={styles.stat}>
					<Text style={styles.statLabel}>{tt('progress.workouts30d')}</Text>
					<Text style={styles.statValue}>{overview.workouts30d}</Text>
				</View>
				<View style={styles.stat}>
					<Text style={styles.statLabel}>{tt('progress.volume30d')}</Text>
					<Text style={styles.statValue}>{overview.volume30dKg}</Text>
				</View>
			</View>
			<Panel>
				<Text style={styles.sectionTitle}>{tt('progress.volumeByWeek')}</Text>
				{overview.weeks.length === 0 ? (
					<>
						<Text style={styles.muted}>{tt('progress.empty')}</Text>
						<PrimaryButton
							label={tt('progress.emptyCta')}
							onPress={() => router.push('/')}
						/>
					</>
				) : (
					overview.weeks.map((w) => (
						<View key={w.weekKey} style={styles.weekRow}>
							<Text style={styles.weekLabel}>{w.weekKey.slice(5)}</Text>
							<View style={styles.barTrack}>
								<View
									style={[
										styles.barFill,
										{ width: `${Math.round((w.volumeKg / maxWeekVol) * 100)}%` }
									]}
								/>
							</View>
							<Text style={styles.weekMeta}>
								{w.volumeKg} · {w.workouts}
							</Text>
						</View>
					))
				)}
			</Panel>
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: space.md },
		lead: { color: colors.muted, fontSize: 15, lineHeight: 21 },
		stats: { flexDirection: 'row', gap: space.sm },
		stat: {
			flex: 1,
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.md
		},
		statLabel: { color: colors.muted, fontSize: 12 },
		statValue: {
			color: colors.text,
			fontSize: 24,
			fontWeight: '800',
			marginTop: 4,
			fontVariant: ['tabular-nums']
		},
		sectionTitle: {
			color: colors.muted,
			fontWeight: '700',
			fontSize: 12,
			textTransform: 'uppercase',
			letterSpacing: 0.5,
			marginBottom: space.sm
		},
		muted: { color: colors.muted },
		weekRow: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			marginBottom: space.sm
		},
		weekLabel: { width: 48, color: colors.muted, fontSize: 13, fontWeight: '600' },
		barTrack: {
			flex: 1,
			height: 10,
			borderRadius: radius.sm,
			backgroundColor: colors.border,
			overflow: 'hidden'
		},
		barFill: { height: '100%', backgroundColor: colors.accent },
		weekMeta: {
			width: 72,
			textAlign: 'right',
			color: colors.muted,
			fontSize: 12,
			fontVariant: ['tabular-nums']
		}
	});
}
