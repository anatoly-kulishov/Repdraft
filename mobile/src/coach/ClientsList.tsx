import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart3, MessageSquare } from 'lucide-react-native';
import { clientInitials, type CoachSessionSummary } from '@repdraft/domain/coach';
import { formatKgInt } from '@repdraft/domain/format';
import { formatRelativeDayShort } from '@repdraft/i18n/format';
import type { CoachRecentSession } from '../storage/coachRepo';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';
import type { ClientStatus, CoachClientRow } from './useCoachClients';

type Props = {
	rows: CoachClientRow[];
	/** Total clients before the local search filter (header count). */
	totalCount: number;
	/** False when the stats RPC failed: statuses become "Нет данных". */
	statsReady: boolean;
	weekActive: number;
	busy: boolean;
	expanded: Record<string, boolean>;
	sessionsByRow: Record<string, CoachRecentSession[]>;
	statusLine: (summary: CoachSessionSummary) => ClientStatus;
	onToggle: (row: CoachClientRow) => void;
	onQuickAction: (row: CoachClientRow) => void;
	onOpenSession: (sessionId: string) => void;
	onRevoke: (row: CoachClientRow) => void;
	onAssign: (row: CoachClientRow) => void;
};

/** Shared-card client list: identical rows, quiet dividers, one quick action. */
export function ClientsList({
	rows,
	totalCount,
	statsReady,
	weekActive,
	busy,
	expanded,
	sessionsByRow,
	statusLine,
	onToggle,
	onQuickAction,
	onOpenSession,
	onRevoke,
	onAssign
}: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<View style={styles.block}>
			<View style={styles.head}>
				<Text style={styles.blockTitle}>{tt('coach.clientsCount', { n: totalCount })}</Text>
				<Text style={styles.weekActive}>
					{statsReady ? tt('coach.weekActive', { n: weekActive }) : '—'}
				</Text>
			</View>
			<View style={styles.card}>
				{rows.map((row, idx) => {
					const status = statsReady
						? statusLine(row.summary)
						: { text: tt('coach.noStats'), active: false };
					const isOpen = expanded[row.key] ?? false;
					const recent = sessionsByRow[row.key] ?? [];
					const activeWeek = row.summary.sessions7d > 0;
					return (
						<Pressable
							key={row.key}
							accessibilityRole="button"
							accessibilityLabel={row.label}
							accessibilityHint={tt('coach.rowHint')}
							onPress={() => onToggle(row)}
							style={({ pressed }) => [
								styles.row,
								idx > 0 && styles.rowDivider,
								pressed && styles.pressed
							]}
						>
							<View style={styles.rowMain}>
								<View style={styles.avatar}>
									<Text style={styles.avatarText}>{clientInitials(row.label)}</Text>
								</View>
								<View style={styles.copy}>
									<Text style={styles.name} numberOfLines={1}>
										{row.label}
									</Text>
									<View style={styles.statusRow}>
										{status.active ? <View style={styles.statusDot} /> : null}
										<Text
											style={[
												styles.statusText,
												status.active ? styles.statusActive : styles.statusNeutral
											]}
											numberOfLines={1}
										>
											{status.text}
										</Text>
									</View>
									{row.summary.lastPlanName && row.summary.lastSessionAt ? (
										<Text style={styles.lastSession} numberOfLines={1}>
											{tt('coach.lastSessionShort', {
												name: row.summary.lastPlanName
											})}
											{' · '}
											{formatRelativeDayShort(row.summary.lastSessionAt, locale)}
										</Text>
									) : null}
								</View>
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={
										activeWeek ? tt('coach.results') : tt('coach.remind')
									}
									onPress={() => onQuickAction(row)}
									style={({ pressed }) => [styles.quickChip, pressed && styles.pressed]}
								>
									{activeWeek ? (
										<BarChart3
											color={colors.accentText}
											size={18}
											strokeWidth={2}
										/>
									) : (
										<MessageSquare
											color={colors.accentText}
											size={18}
											strokeWidth={2}
										/>
									)}
									<Text style={styles.quickChipText}>
										{activeWeek ? tt('coach.results') : tt('coach.remind')}
									</Text>
								</Pressable>
							</View>

							{isOpen ? (
								<View style={styles.expanded}>
									<Text style={styles.totals}>
										{tt('coach.totalsLine', {
											sessions: row.summary.sessions,
											sets: row.summary.sets,
											kg: formatKgInt(row.summary.volumeKg)
										})}
									</Text>
									{recent.length === 0 ? (
										<Text style={styles.muted}>{tt('coach.sessionDetailEmpty')}</Text>
									) : (
										recent.map((session) => (
											<Pressable
												key={session.id}
												style={({ pressed }) => [
													styles.sessionRow,
													pressed && styles.pressed
												]}
												onPress={() => onOpenSession(session.id)}
											>
												<Text style={styles.sessionName} numberOfLines={1}>
													{session.planName || tt('coach.sessionDetailTitle')}
												</Text>
												<Text style={styles.sessionMeta}>
													{tt('coach.sessionMeta', {
														when: formatRelativeDayShort(session.finishedAt, locale),
														sets: String(session.sets),
														volume: String(session.volumeKg)
													})}
												</Text>
											</Pressable>
										))
									)}
									<Pressable
										accessibilityRole="button"
										style={({ pressed }) => [
											styles.assignBtn,
											pressed && styles.pressed
										]}
										onPress={() => onAssign(row)}
										disabled={busy}
									>
										<Text style={styles.assignText}>{tt('coach.assign')}</Text>
									</Pressable>
									<Pressable
										accessibilityRole="button"
										style={({ pressed }) => [
											styles.revokeLink,
											pressed && styles.pressed
										]}
										onPress={() => onRevoke(row)}
										disabled={busy}
									>
										<Text style={styles.revokeText}>{tt('coach.revoke')}</Text>
									</Pressable>
								</View>
							) : null}
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		block: { gap: space.md },
		head: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: space.sm
		},
		blockTitle: {
			color: colors.text,
			fontSize: 18,
			lineHeight: 24,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		weekActive: {
			color: colors.muted,
			fontSize: 13,
			lineHeight: 18,
			fontFamily: fontFamily.regular,
			textAlign: 'right'
		},
		card: {
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			overflow: 'hidden'
		},
		row: { padding: space.lg, gap: space.md },
		rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.bg },
		rowMain: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.md
		},
		avatar: {
			width: 40,
			height: 40,
			borderRadius: 20,
			backgroundColor: colors.panelRaised,
			alignItems: 'center',
			justifyContent: 'center'
		},
		avatarText: {
			color: colors.text,
			fontSize: 15,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		copy: { flex: 1, gap: 2, minWidth: 0 },
		name: {
			color: colors.text,
			fontSize: 16,
			lineHeight: 22,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
		statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success },
		statusText: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
		lastSession: {
			color: colors.muted,
			fontSize: 12,
			lineHeight: 16,
			fontFamily: fontFamily.regular
		},
		statusActive: { color: colors.success },
		statusNeutral: { color: colors.mutedSoft },
		quickChip: {
			minWidth: 64,
			alignItems: 'center',
			justifyContent: 'center',
			gap: 4,
			paddingHorizontal: space.sm,
			paddingVertical: space.sm,
			borderRadius: radius.control,
			backgroundColor: colors.accentDim
		},
		quickChipText: {
			color: colors.secondary,
			fontSize: 11,
			lineHeight: 14,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		expanded: {
			gap: space.sm,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.bg,
			paddingTop: space.md
		},
		totals: {
			color: colors.muted,
			fontSize: 12,
			lineHeight: 16,
			fontFamily: fontFamily.regular
		},
		sessionRow: { minHeight: touchMin, justifyContent: 'center', gap: 2 },
		sessionName: {
			color: colors.text,
			fontSize: 14,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		sessionMeta: {
			color: colors.muted,
			fontSize: 12,
			lineHeight: 16,
			fontFamily: fontFamily.regular
		},
		revokeLink: {
			alignSelf: 'flex-start',
			minHeight: touchMin,
			justifyContent: 'center',
			paddingHorizontal: space.md,
			borderRadius: radius.control,
			borderWidth: 1,
			borderColor: colors.border
		},
		assignBtn: {
			alignSelf: 'stretch',
			minHeight: touchMin,
			alignItems: 'center',
			justifyContent: 'center',
			paddingHorizontal: space.md,
			borderRadius: radius.control,
			backgroundColor: colors.accentDim
		},
		assignText: {
			color: colors.accentText,
			fontSize: 14,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		revokeText: {
			color: colors.danger,
			fontSize: 13,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		muted: {
			color: colors.muted,
			fontSize: 14,
			fontFamily: fontFamily.regular,
			lineHeight: 20
		},
		pressed: { opacity: 0.85 }
	});
}
