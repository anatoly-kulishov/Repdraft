import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import { Users } from 'lucide-react-native';
import { ClientSessionSheet } from '../src/coach/ClientSessionSheet';
import { ClientsHeader } from '../src/coach/ClientsHeader';
import { ClientsList } from '../src/coach/ClientsList';
import { ClientsSkeleton } from '../src/coach/ClientsSkeleton';
import { InviteCard } from '../src/coach/InviteCard';
import { InviteSheets } from '../src/coach/InviteSheets';
import { useCoachClients } from '../src/coach/useCoachClients';
import { AssignPlanSheet } from '../src/coach/AssignPlanSheet';
import { coachRepo } from '../src/storage/coachRepo';
import { ConfirmSheet } from '../src/components/ConfirmSheet';
import type { CoachAssignablePlan } from '@repdraft/domain/coach';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { useBottomChromePad } from '../src/layout/safe';
import { useLocale } from '../src/state/locale';
import { useAppColors } from '../src/state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../src/theme';

export default function ClientsScreen() {
	const router = useRouter();
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const coach = useCoachClients();
	const [helpOpen, setHelpOpen] = useState(false);
	const [inviteMenuOpen, setInviteMenuOpen] = useState(false);
	const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
	const [query, setQuery] = useState('');
	const [assignTarget, setAssignTarget] = useState<(typeof coach.rows)[number] | null>(null);
	const [assignPlans, setAssignPlans] = useState<CoachAssignablePlan[]>([]);
	const [assignLoading, setAssignLoading] = useState(false);
	const [assignBusy, setAssignBusy] = useState(false);
	const [assignToast, setAssignToast] = useState<string | null>(null);

	async function openAssign(row: (typeof coach.rows)[number]) {
		setAssignTarget(row);
		setAssignPlans([]);
		setAssignLoading(true);
		try {
			const result = await coachRepo.listAssignablePlans();
			if (result.ok) setAssignPlans(result.value);
			else setAssignToast(tt(`coach.error.${result.reason}`));
		} finally {
			setAssignLoading(false);
		}
	}

	function dismissAssign() {
		if (assignBusy) return;
		setAssignTarget(null);
		setAssignPlans([]);
	}

	async function pickAssign(plan: CoachAssignablePlan) {
		const target = assignTarget;
		if (!target || assignBusy) return;
		setAssignBusy(true);
		try {
			const result = await coachRepo.assignPlan(target.clientUserId, plan.planId);
			if (result.ok) {
				setAssignToast(tt('coach.assignDone'));
				setAssignTarget(null);
				setAssignPlans([]);
			} else {
				setAssignToast(tt(`coach.error.${result.reason}`));
			}
		} finally {
			setAssignBusy(false);
		}
	}

	const filteredRows = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return coach.rows;
		return coach.rows.filter((row) => row.label.toLowerCase().includes(needle));
	}, [coach.rows, query]);

	function onQuickAction(row: (typeof coach.rows)[number]) {
		if (row.summary.sessions7d <= 0) {
			void coach.remind(row.label);
			return;
		}
		if (row.summary.lastSessionId) void coach.openSession(row.summary.lastSessionId);
		else void coach.toggleRow(row);
	}

	return (
		<View style={styles.page}>
			<ClientsHeader
				onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
				onHelp={() => setHelpOpen(true)}
				onSettings={() => router.push('/(tabs)/profile')}
			/>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl
						refreshing={coach.refreshing}
						onRefresh={() => void coach.reload()}
						tintColor={colors.accent}
					/>
				}
			>
				{coach.toast ? <Text style={styles.toast}>{coach.toast}</Text> : null}
				{assignToast ? <Text style={styles.toast}>{assignToast}</Text> : null}

				<InviteCard
					code={coach.inviteCode}
					busy={coach.busy}
					onCreate={() => void coach.createInvite()}
					onCopy={() => void coach.copyInvite()}
					onShare={() => void coach.shareInvite()}
					onMenu={() => setInviteMenuOpen(true)}
				/>

				{!coach.loaded && coach.busy ? (
					<ClientsSkeleton />
				) : coach.signedOut ? (
					<View style={styles.emptyCard}>
						<View style={styles.emptyIcon}>
							<Users color={colors.accentText} size={28} strokeWidth={1.75} />
						</View>
						<Text style={styles.emptyTitle}>{tt('coach.signInTitle')}</Text>
						<Text style={styles.emptyBody}>{tt('coach.signInLead')}</Text>
						<PrimaryButton
							label={tt('nav.signIn')}
							onPress={() => router.push('/(tabs)/profile')}
						/>
					</View>
				) : coach.rows.length === 0 ? (
					<View style={styles.emptyCard}>
						<View style={styles.emptyIcon}>
							<Users color={colors.accentText} size={28} strokeWidth={1.75} />
						</View>
						<Text style={styles.emptyTitle}>{tt('coach.emptyTitle')}</Text>
						<Text style={styles.emptyBody}>{tt('coach.emptyBody')}</Text>
						<PrimaryButton
							label={
								coach.inviteCode
									? tt('coach.inviteShare')
									: tt('coach.inviteCreateShort')
							}
							disabled={coach.busy}
							onPress={() => void coach.inviteFirstClient()}
						/>
					</View>
				) : (
					<View style={styles.listBlock}>
						{coach.rows.length > 4 ? (
							<TextInput
								value={query}
								onChangeText={setQuery}
								placeholder={tt('coach.searchPlaceholder')}
								placeholderTextColor={colors.muted}
								style={styles.search}
								autoCorrect={false}
								returnKeyType="search"
							/>
						) : null}
						{filteredRows.length === 0 ? (
							<Text style={styles.noMatches}>{tt('coach.noMatches')}</Text>
						) : (
							<ClientsList
								rows={filteredRows}
								totalCount={coach.rows.length}
								statsReady={coach.statsReady}
								weekActive={coach.weekActive}
								busy={coach.busy}
								expanded={coach.expanded}
								sessionsByRow={coach.sessionsByRow}
								statusLine={coach.statusLine}
								onToggle={(row) => void coach.toggleRow(row)}
								onQuickAction={onQuickAction}
								onOpenSession={(id) => void coach.openSession(id)}
								onRevoke={coach.setRevokeTarget}
								onAssign={(row) => void openAssign(row)}
							/>
						)}
					</View>
				)}
			</ScrollView>

			<InviteSheets
				helpOpen={helpOpen}
				onCloseHelp={() => setHelpOpen(false)}
				menuOpen={inviteMenuOpen}
				onCloseMenu={() => setInviteMenuOpen(false)}
				hasCode={Boolean(coach.inviteCode)}
				busy={coach.busy}
				onCopy={() => void coach.copyInvite()}
				onRefresh={() => setRefreshConfirmOpen(true)}
				refreshConfirmOpen={refreshConfirmOpen}
				onCloseRefreshConfirm={() => setRefreshConfirmOpen(false)}
				onConfirmRefresh={() => void coach.refreshInvite()}
			/>

			<AssignPlanSheet
				open={assignTarget !== null}
				clientLabel={assignTarget?.label ?? ''}
				loading={assignLoading}
				busy={assignBusy}
				plans={assignPlans}
				onPick={(plan) => void pickAssign(plan)}
				onDismiss={dismissAssign}
			/>

			<ConfirmSheet
				open={coach.revokeTarget !== null}
				title={tt('coach.revokeConfirmTitle')}
				message={tt('coach.revokeConfirmLead', { name: coach.revokeTarget?.label ?? '' })}
				onDismiss={() => coach.setRevokeTarget(null)}
				actions={[
					{
						label: tt('coach.revoke'),
						variant: 'danger',
						onPress: () => {
							const target = coach.revokeTarget;
							if (target) void coach.revokeRow(target);
						}
					}
				]}
			/>

			<ClientSessionSheet
				open={coach.sessionOpen}
				detail={coach.sessionDetail}
				busy={coach.sessionBusy}
				onClose={coach.closeSession}
			/>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		page: { flex: 1, backgroundColor: colors.bg },
		scroll: { flex: 1 },
		root: { padding: space.lg, gap: 24 },
		toast: {
			color: colors.accentText,
			fontFamily: fontFamily.semibold,
			fontSize: 13,
			textAlign: 'center'
		},
		listBlock: { gap: space.md },
		search: {
			minHeight: touchMin,
			borderRadius: radius.control,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel,
			color: colors.text,
			paddingHorizontal: space.md,
			fontSize: 15,
			fontFamily: fontFamily.regular
		},
		noMatches: {
			color: colors.muted,
			fontSize: 14,
			textAlign: 'center',
			paddingVertical: space.lg,
			fontFamily: fontFamily.regular
		},
		emptyCard: {
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			paddingHorizontal: space.lg,
			paddingVertical: 24,
			alignItems: 'center',
			gap: space.sm
		},
		emptyIcon: {
			width: 56,
			height: 56,
			borderRadius: 28,
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: colors.accentDim,
			marginBottom: space.xs
		},
		emptyTitle: {
			color: colors.text,
			fontSize: 16,
			fontWeight: '700',
			fontFamily: fontFamily.bold,
			textAlign: 'center'
		},
		emptyBody: {
			color: colors.muted,
			fontSize: 13,
			lineHeight: 19,
			fontFamily: fontFamily.regular,
			textAlign: 'center',
			marginBottom: space.sm
		}
	});
}
