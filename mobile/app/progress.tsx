import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { labelBodyPart } from '@repdraft/domain/labels.ru';
import { computeProgressOverview } from '@repdraft/domain/progressOverview';
import type { WorkoutSession } from '@repdraft/domain/types';
import { exerciseDisplayName, getIndexItem, refreshCustomsCache } from '../src/catalog/loadIndex';
import { Panel } from '../src/components/Panel';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { useBottomChromePad } from '../src/layout/safe';
import { useLocale } from '../src/state/locale';
import { useAppColors } from '../src/state/theme';
import { sessionsRepo } from '../src/storage/sessionsRepo';
import { fontFamily, radius, space, type ColorPalette } from '../src/theme';

export default function ProgressScreen() {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const [sessions, setSessions] = useState<WorkoutSession[]>([]);

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				await refreshCustomsCache();
				setSessions(await sessionsRepo.list());
			})();
		}, [])
	);

	const overview = useMemo(
		() => computeProgressOverview(sessions, new Date(), (id) => getIndexItem(id)?.body_part ?? null),
		[sessions]
	);
	const maxWeekVol = Math.max(1, ...overview.weeks.map((w) => w.volumeKg));

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
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
			{overview.bodyParts.length > 0 ? (
				<Panel>
					<Text style={styles.sectionTitle}>{tt('progress.bodyParts')}</Text>
					{overview.bodyParts.map((part) => {
						const lagging = part.bodyPart === overview.laggingBodyPart;
						return (
							<View key={part.bodyPart} style={styles.part}>
								<View style={styles.partTop}>
									<View style={styles.partLabelRow}>
										<Text style={styles.partLabel} numberOfLines={1}>
											{labelBodyPart(part.bodyPart, locale)}
										</Text>
										{lagging ? (
											<View style={styles.lagTag}>
												<Text style={styles.lagTagText}>{tt('progress.lagging')}</Text>
											</View>
										) : null}
									</View>
									<Text style={styles.weekMeta}>{part.sharePct}%</Text>
								</View>
								<View style={styles.barTrack}>
									<View
										style={[
											styles.barFill,
											lagging && styles.barLag,
											{ width: `${part.sharePct}%` }
										]}
									/>
								</View>
							</View>
						);
					})}
				</Panel>
			) : null}
			{overview.trends.length > 0 ? (
				<Panel>
					<Text style={styles.sectionTitle}>{tt('progress.trends')}</Text>
					{overview.trends.map((row) => (
						<Text key={row.exerciseId} style={styles.muted}>
							{exerciseDisplayName(row.exerciseId, locale)} · {row.deltaKg > 0 ? '+' : ''}
							{row.deltaKg} kg
						</Text>
					))}
				</Panel>
			) : null}
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: space.md },
		lead: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: fontFamily.regular },
		stats: { flexDirection: 'row', gap: space.sm },
		stat: {
			flex: 1,
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.md
		},
		statLabel: { color: colors.muted, fontSize: 12, fontFamily: fontFamily.regular },
		statValue: {
			color: colors.text,
			fontSize: 24,
			fontWeight: '800',
			marginTop: 4,
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.extrabold
		},
		sectionTitle: {
			color: colors.muted,
			fontWeight: '700',
			fontSize: 12,
			textTransform: 'uppercase',
			letterSpacing: 0.5,
			marginBottom: space.sm,
			fontFamily: fontFamily.bold
		},
		muted: { color: colors.muted, fontFamily: fontFamily.regular },
		weekRow: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			marginBottom: space.sm
		},
		weekLabel: { width: 48, color: colors.muted, fontSize: 13, fontWeight: '600', fontFamily: fontFamily.semibold },
		part: { gap: 6, marginBottom: 10 },
		partTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
		partLabelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minWidth: 0 },
		partLabel: { flexShrink: 1, color: colors.text, fontSize: 13, fontWeight: '600', fontFamily: fontFamily.semibold },
		lagTag: {
			paddingHorizontal: 8,
			paddingVertical: 3,
			borderRadius: radius.sm,
			backgroundColor: colors.dangerBg
		},
		lagTagText: {
			color: colors.danger,
			fontSize: 11,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		barTrack: {
			flex: 1,
			height: 10,
			borderRadius: radius.sm,
			backgroundColor: colors.border,
			overflow: 'hidden'
		},
		barFill: { height: '100%', backgroundColor: colors.accent },
		barLag: { backgroundColor: colors.danger },
		weekMeta: {
			width: 72,
			textAlign: 'right',
			color: colors.muted,
			fontSize: 12,
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.regular
		}
	});
}
