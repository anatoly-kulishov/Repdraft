import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { completedSetCount, sessionDurationMinutes } from '@repdraft/domain/session';
import type { WorkoutSession } from '@repdraft/domain/types';
import { formatRelativeDayShort } from '@repdraft/i18n/format';
import { translatePlural } from '@repdraft/i18n/messages';
import { Panel } from '../components/Panel';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	recent: WorkoutSession[];
	hasPlans: boolean;
	showGuestHero: boolean;
	onOpenSession: (sessionId: string) => void;
	onOpenHistory: () => void;
};

/** "Недавние тренировки" card: clean meta, no chevrons, + empty states. */
export function RecentSessionsCard({
	recent,
	hasPlans,
	showGuestHero,
	onOpenSession,
	onOpenHistory
}: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	if (recent.length === 0) {
		if (showGuestHero) return null;
		const title = hasPlans ? tt('home.firstWorkoutTitle') : tt('home.recentPlaceholderTitle');
		const hint = hasPlans ? tt('home.firstWorkoutHint') : tt('home.recentPlaceholderHint');
		return (
			<Panel>
				<Text style={styles.sectionTitle}>{title}</Text>
				<Text style={styles.hint}>{hint}</Text>
			</Panel>
		);
	}

	return (
		<View style={styles.section}>
			<View style={styles.sectionHead}>
				<Text style={styles.sectionTitle}>{tt('home.recentTitle')}</Text>
				<Pressable
					accessibilityRole="button"
					style={styles.sectionLink}
					onPress={onOpenHistory}
				>
					<Text style={styles.sectionLinkText}>{tt('home.recentAll')}</Text>
					<ChevronRight color={colors.mutedSoft} size={16} strokeWidth={2.25} />
				</Pressable>
			</View>
			<View style={styles.list}>
				{recent.map((session, idx) => {
					const minutes = sessionDurationMinutes(session);
					const sets = completedSetCount(session);
					const meta = [
						formatRelativeDayShort(session.finishedAt ?? session.startedAt, locale),
						minutes != null ? tt('home.recentDuration', { n: minutes }) : null,
						sets > 0 ? translatePlural(locale, 'home.recentSets', sets) : null
					]
						.filter((part): part is string => Boolean(part))
						.join(tt('common.sep'));
					return (
						<Pressable
							key={session.id}
							accessibilityRole="button"
							style={({ pressed }) => [
								styles.row,
								idx > 0 && styles.rowDivider,
								pressed && styles.pressed
							]}
							onPress={() => onOpenSession(session.id)}
						>
							<View style={styles.rowBody}>
								<Text style={styles.rowTitle} numberOfLines={1}>
									{session.planName || '-'}
								</Text>
								<Text style={styles.rowMeta} numberOfLines={1}>
									{meta}
								</Text>
							</View>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		section: { gap: space.md },
		sectionHead: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			minHeight: touchMin
		},
		sectionTitle: {
			fontSize: 16,
			lineHeight: 22,
			fontWeight: '700',
			fontFamily: fontFamily.bold,
			color: colors.text
		},
		sectionLink: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 2,
			minHeight: touchMin,
			paddingHorizontal: space.sm
		},
		sectionLinkText: {
			fontSize: 14,
			lineHeight: 18,
			fontWeight: '500',
			fontFamily: fontFamily.medium,
			color: colors.mutedSoft
		},
		list: {
			overflow: 'hidden',
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel
		},
		row: {
			minHeight: touchMin,
			paddingHorizontal: space.lg,
			paddingVertical: space.lg,
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm
		},
		rowDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
		rowBody: { flex: 1, gap: 4 },
		rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: fontFamily.bold },
		rowMeta: {
			fontSize: 12,
			lineHeight: 16,
			fontWeight: '400',
			fontFamily: fontFamily.regular,
			color: colors.mutedSoft
		},
		hint: { color: colors.muted, fontFamily: fontFamily.regular, lineHeight: 20 },
		pressed: { opacity: 0.85 }
	});
}
