import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View
} from 'react-native';
import {
	clientActivityTier,
	daysSinceLastSession,
	formatInviteCode,
	type CoachClientLink,
	type CoachSessionDetail,
	type CoachSessionSummary
} from '@repdraft/domain/coach';
import { loggedSetKind, setKindMessageKey } from '@repdraft/domain/session';
import { formatRelativeDay } from '@repdraft/i18n/format';
import { getSupabase, isSupabaseConfigured } from '../src/auth/supabase';
import { exerciseDisplayName, refreshCustomsCache } from '../src/catalog/loadIndex';
import { BottomSheet } from '../src/components/BottomSheet';
import { ConfirmSheet } from '../src/components/ConfirmSheet';
import { Panel } from '../src/components/Panel';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { useBottomChromePad } from '../src/layout/safe';
import { useLocale } from '../src/state/locale';
import { useAppColors } from '../src/state/theme';
import {
	coachRepo,
	type CoachErrorReason,
	type CoachRecentSession
} from '../src/storage/coachRepo';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../src/theme';

type Row = {
	key: string;
	label: string;
	linkId: string;
	clientUserId: string;
	summary: CoachSessionSummary;
};

function emptySummary(): CoachSessionSummary {
	return {
		sessions: 0,
		sets: 0,
		volumeKg: 0,
		lastSessionAt: null,
		sessions7d: 0,
		activeRecently: false,
		lastSessionId: null,
		lastPlanName: null
	};
}

export default function ClientsScreen() {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);

	const cloud = isSupabaseConfigured();
	const [me, setMe] = useState('');
	const [links, setLinks] = useState<CoachClientLink[]>([]);
	const [stats, setStats] = useState<Record<string, CoachSessionSummary>>({});
	const [inviteCode, setInviteCode] = useState<string | null>(null);
	const [inviteOpen, setInviteOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const [sessionsByRow, setSessionsByRow] = useState<Record<string, CoachRecentSession[]>>({});
	const [revokeTarget, setRevokeTarget] = useState<Row | null>(null);
	const [sessionOpen, setSessionOpen] = useState(false);
	const [sessionDetail, setSessionDetail] = useState<CoachSessionDetail | null>(null);
	const [sessionBusy, setSessionBusy] = useState(false);
	const [toast, setToast] = useState<string | null>(null);

	const rows = useMemo<Row[]>(() => {
		return links
			.filter((link) => link.coachUserId === me && link.status === 'active')
			.map((link) => ({
				key: link.id,
				label: link.note?.trim() || `${tt('coach.clientFallback')} ${link.clientUserId.slice(0, 4).toUpperCase()}`,
				linkId: link.id,
				clientUserId: link.clientUserId,
				summary: stats[link.clientUserId] ?? emptySummary()
			}))
			.sort((a, b) => (b.summary.lastSessionAt ?? '').localeCompare(a.summary.lastSessionAt ?? ''));
	}, [links, me, stats, tt]);

	const weekActive = rows.filter((row) => row.summary.sessions7d > 0).length;
	const showInvitePanel = rows.length === 0 || inviteOpen || Boolean(inviteCode);

	function errorText(reason: CoachErrorReason): string {
		return tt(`coach.error.${reason}`);
	}

	function showToast(message: string) {
		setToast(message);
		setTimeout(() => setToast(null), 2200);
	}

	const refresh = useCallback(async () => {
		if (!cloud) return;
		const sb = getSupabase();
		const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
		const userId = data.session?.user?.id ?? '';
		setMe(userId);
		if (!userId) {
			setLoaded(true);
			return;
		}
		const [linkRes, statsRes] = await Promise.all([coachRepo.listLinks(), coachRepo.stats()]);
		if (linkRes.ok) setLinks(linkRes.value);
		else showToast(tt(`coach.error.${linkRes.reason}`));
		if (statsRes.ok) {
			setStats(Object.fromEntries(statsRes.value.map((row) => [row.clientUserId, row.summary])));
		} else if (statsRes.reason !== 'notConfigured') {
			showToast(tt(`coach.error.${statsRes.reason}`));
		}
		setLoaded(true);
	}, [cloud, tt]);

	useFocusEffect(
		useCallback(() => {
			void refreshCustomsCache();
			if (!cloud || loaded) return;
			setBusy(true);
			void refresh().finally(() => setBusy(false));
		}, [cloud, loaded, refresh])
	);

	async function createInvite() {
		setBusy(true);
		try {
			const result = await coachRepo.createInvite();
			if (result.ok) {
				setInviteCode(result.value);
				setInviteOpen(true);
			} else showToast(errorText(result.reason));
		} finally {
			setBusy(false);
		}
	}

	async function copyInvite() {
		if (!inviteCode) return;
		await Clipboard.setStringAsync(formatInviteCode(inviteCode));
		showToast(tt('coach.inviteCopied'));
	}

	async function toggleRow(row: Row) {
		const next = !(expanded[row.key] ?? false);
		setExpanded((prev) => ({ ...prev, [row.key]: next }));
		if (!next || sessionsByRow[row.key]) return;
		const result = await coachRepo.recentSessions(row.clientUserId, 5);
		if (result.ok) setSessionsByRow((prev) => ({ ...prev, [row.key]: result.value }));
		else showToast(errorText(result.reason));
	}

	async function openSession(sessionId: string | null | undefined) {
		if (!sessionId) return;
		setSessionOpen(true);
		setSessionDetail(null);
		setSessionBusy(true);
		try {
			const result = await coachRepo.sessionDetail(sessionId);
			if (result.ok) setSessionDetail(result.value);
			else {
				showToast(errorText(result.reason));
				setSessionOpen(false);
			}
		} finally {
			setSessionBusy(false);
		}
	}

	async function revokeRow(row: Row) {
		setBusy(true);
		try {
			const result = await coachRepo.revoke(row.linkId);
			if (result.ok) await refresh();
			else showToast(errorText(result.reason));
		} finally {
			setBusy(false);
		}
	}

	function statusLine(summary: CoachSessionSummary) {
		const tier = clientActivityTier(summary);
		const days = daysSinceLastSession(summary);
		if (tier === 'silent') return { text: tt('coach.tierSilent'), tone: 'stale' as const };
		if (tier === 'active') return { text: tt('coach.tierActive', { n: String(days ?? 0) }), tone: 'active' as const };
		if (tier === 'calm') return { text: tt('coach.tierCalm', { n: String(days ?? 0) }), tone: 'calm' as const };
		return { text: tt('coach.tierStale', { n: String(days ?? 0) }), tone: 'stale' as const };
	}

	function setLine(weightKg: number | null, reps: number | null): string {
		if (weightKg == null && reps == null) return tt('coach.sessionSetEmpty');
		return tt('coach.sessionSetLine', {
			weight: String(weightKg ?? tt('coach.sessionSetEmpty')),
			reps: String(reps ?? tt('coach.sessionSetEmpty'))
		});
	}

	if (!cloud) {
		return (
			<ScrollView style={styles.scroll} contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}>
				<Panel>
					<Text style={styles.muted}>{tt('coach.error.notConfigured')}</Text>
				</Panel>
			</ScrollView>
		);
	}

	return (
		<>
			<ScrollView style={styles.scroll} contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}>
				{toast ? <Text style={styles.toast}>{toast}</Text> : null}

				<Panel>
					<Text style={styles.badge}>{tt('coach.cloudBadge')}</Text>
					<Text style={styles.muted}>{tt('coach.cloudLead')}</Text>
				</Panel>

				{showInvitePanel ? (
					<Panel>
						<Text style={styles.sectionTitle}>{tt('coach.inviteTitle')}</Text>
						<Text style={styles.muted}>{tt('coach.inviteLead')}</Text>
						{inviteCode ? (
							<>
								<Text style={styles.inviteCode}>{formatInviteCode(inviteCode)}</Text>
								<PrimaryButton label={tt('coach.inviteCopy')} variant="secondary" onPress={() => void copyInvite()} />
								<PrimaryButton
									label={tt('coach.inviteRefresh')}
									variant="link"
									onPress={() => {
										setInviteCode(null);
										void createInvite();
									}}
								/>
							</>
						) : (
							<PrimaryButton
								label={tt('coach.inviteCreate')}
								onPress={() => void createInvite()}
								disabled={busy}
							/>
						)}
					</Panel>
				) : (
					<PrimaryButton
						label={tt('coach.inviteCollapsed')}
						variant="link"
						onPress={() => void createInvite()}
						disabled={busy}
					/>
				)}

				<View style={styles.listHeader}>
					<Text style={styles.sectionTitle}>{tt('coach.clientsTitle')}</Text>
					<Text style={styles.muted}>{rows.length}</Text>
				</View>
				{rows.length > 0 ? (
					<Text style={styles.summaryLine}>
						{tt('coach.summaryLine', { total: String(rows.length), week: String(weekActive) })}
					</Text>
				) : null}

				{!loaded && busy ? (
					<ActivityIndicator color={colors.accent} style={{ marginTop: space.md }} />
				) : rows.length === 0 ? (
					<Panel>
						<Text style={styles.sectionTitle}>{tt('coach.clientsEmpty')}</Text>
						<Text style={styles.muted}>{tt('coach.clientsEmptyCloud')}</Text>
					</Panel>
				) : (
					rows.map((row) => {
						const status = statusLine(row.summary);
						const isOpen = expanded[row.key] ?? false;
						const lastName = row.summary.lastPlanName?.trim() || null;
						const lastId = row.summary.lastSessionId ?? null;
						const recent = sessionsByRow[row.key] ?? [];
						return (
							<Panel key={row.key}>
								<Text style={styles.clientName}>{row.label}</Text>
								<Text
									style={[
										styles.status,
										status.tone === 'active'
											? { color: colors.accent }
											: status.tone === 'stale'
												? { color: colors.danger }
												: { color: colors.muted }
									]}
								>
									{status.text}
								</Text>
								{lastName && lastId ? (
									<Pressable
										style={styles.lastSession}
										onPress={() => void openSession(lastId)}
									>
										<Text style={styles.lastSessionName} numberOfLines={1}>
											{tt('coach.lastSession', { name: lastName })}
										</Text>
										{row.summary.lastSessionAt ? (
											<Text style={styles.muted}>
												{tt('coach.lastSessionWhen', {
													when: formatRelativeDay(row.summary.lastSessionAt, locale)
												})}
											</Text>
										) : null}
									</Pressable>
								) : null}
								<View style={styles.rowActions}>
									<PrimaryButton
										label={tt(isOpen ? 'coach.hideSessions' : 'coach.showSessions')}
										variant="link"
										onPress={() => void toggleRow(row)}
									/>
									<PrimaryButton
										label={tt('coach.revoke')}
										variant="link"
										onPress={() => setRevokeTarget(row)}
										disabled={busy}
									/>
								</View>
								{isOpen
									? recent.map((session) => (
											<Pressable
												key={session.id}
												style={styles.sessionRow}
												onPress={() => void openSession(session.id)}
											>
												<Text style={styles.sessionName} numberOfLines={1}>
													{session.planName || tt('coach.sessionDetailTitle')}
												</Text>
												<Text style={styles.muted}>
													{tt('coach.sessionMeta', {
														when: formatRelativeDay(session.finishedAt, locale),
														sets: String(session.sets),
														volume: String(session.volumeKg)
													})}
												</Text>
											</Pressable>
										))
									: null}
							</Panel>
						);
					})
				)}
			</ScrollView>

			<ConfirmSheet
				open={revokeTarget !== null}
				title={tt('coach.revokeConfirmTitle')}
				message={tt('coach.revokeConfirmLead', { name: revokeTarget?.label ?? '' })}
				onDismiss={() => setRevokeTarget(null)}
				actions={[
					{
						label: tt('coach.revoke'),
						variant: 'danger',
						onPress: () => {
							const target = revokeTarget;
							if (target) void revokeRow(target);
						}
					}
				]}
			/>

			<BottomSheet
				open={sessionOpen}
				onDismiss={() => {
					setSessionOpen(false);
					setSessionDetail(null);
				}}
				label={sessionDetail?.planName || tt('coach.sessionDetailTitle')}
				actions={
					<PrimaryButton
						label={tt('common.close')}
						variant="secondary"
						onPress={() => {
							setSessionOpen(false);
							setSessionDetail(null);
						}}
					/>
				}
			>
				<Text style={styles.sheetTitle}>
					{sessionDetail?.planName?.trim() || tt('coach.sessionDetailTitle')}
				</Text>
				{sessionDetail?.finishedAt ? (
					<Text style={styles.muted}>{formatRelativeDay(sessionDetail.finishedAt, locale)}</Text>
				) : null}
				{sessionBusy && !sessionDetail ? (
					<ActivityIndicator color={colors.accent} style={{ marginTop: space.md }} />
				) : null}
				{sessionDetail
					? sessionDetail.exercises
							.filter((ex) => !ex.skipped)
							.map((ex, exIndex) => (
								<View key={`${ex.exerciseId}-${exIndex}`} style={styles.exBlock}>
									<Text style={styles.exTitle}>{exerciseDisplayName(ex.exerciseId, locale)}</Text>
									{(ex.targetSets > 0 || ex.targetReps > 0) && (
										<Text style={styles.muted}>
											{ex.targetSets}×{ex.targetReps}
										</Text>
									)}
									{ex.sets.map((set, i) => {
										const kind = loggedSetKind(set);
										return (
											<View
												key={i}
												style={[styles.setRow, !set.completed && styles.setOpen]}
											>
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
				{sessionDetail &&
				sessionDetail.exercises.filter((ex) => !ex.skipped).length === 0 ? (
					<Text style={styles.muted}>{tt('coach.sessionDetailEmpty')}</Text>
				) : null}
			</BottomSheet>
		</>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.md, gap: space.md },
		toast: {
			color: colors.accent,
			fontFamily: fontFamily.semibold,
			fontSize: 14,
			textAlign: 'center'
		},
		badge: {
			color: colors.muted,
			fontSize: 11,
			fontFamily: fontFamily.semibold,
			textTransform: 'uppercase',
			letterSpacing: 0.6,
			marginBottom: 4
		},
		muted: { color: colors.muted, fontSize: 14, fontFamily: fontFamily.regular, lineHeight: 20 },
		sectionTitle: {
			color: colors.text,
			fontSize: 17,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		inviteCode: {
			color: colors.text,
			fontSize: 28,
			fontWeight: '800',
			fontFamily: fontFamily.extrabold,
			letterSpacing: 4,
			marginVertical: space.sm,
			fontVariant: ['tabular-nums']
		},
		listHeader: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between'
		},
		summaryLine: {
			color: colors.muted,
			fontSize: 13,
			fontFamily: fontFamily.regular,
			marginTop: -space.sm
		},
		clientName: {
			color: colors.text,
			fontSize: 17,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		status: { marginTop: 4, fontSize: 14, fontFamily: fontFamily.semibold },
		lastSession: {
			marginTop: space.sm,
			minHeight: touchMin,
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: radius.md,
			paddingHorizontal: space.sm,
			paddingVertical: space.sm,
			justifyContent: 'center',
			gap: 2,
			backgroundColor: colors.panel
		},
		lastSessionName: {
			color: colors.text,
			fontSize: 15,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
		sessionRow: {
			minHeight: touchMin,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.border,
			paddingVertical: space.sm,
			gap: 2
		},
		sessionName: {
			color: colors.text,
			fontSize: 14,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		sheetTitle: {
			color: colors.text,
			fontSize: 20,
			fontWeight: '800',
			fontFamily: fontFamily.extrabold
		},
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
