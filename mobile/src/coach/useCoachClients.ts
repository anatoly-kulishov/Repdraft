import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share } from 'react-native';
import {
	daysSinceLastSession,
	formatInviteCode,
	type CoachClientLink,
	type CoachSessionDetail,
	type CoachSessionSummary
} from '@repdraft/domain/coach';
import { getSupabase, isSupabaseConfigured } from '../auth/supabase';
import { refreshCustomsCache } from '../catalog/loadIndex';
import { useLocale } from '../state/locale';
import {
	coachRepo,
	type CoachErrorReason,
	type CoachRecentSession
} from '../storage/coachRepo';

export type CoachClientRow = {
	key: string;
	label: string;
	linkId: string;
	clientUserId: string;
	summary: CoachSessionSummary;
};

export type ClientStatus = { text: string; active: boolean };

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

/**
 * All cloud/coach state for the Clients screen: links, stats, invite code,
 * expandable recent sessions, revoke and session-detail sheet.
 */
export function useCoachClients() {
	const { tt } = useLocale();
	const cloud = isSupabaseConfigured();
	const [me, setMe] = useState('');
	const [links, setLinks] = useState<CoachClientLink[]>([]);
	const [stats, setStats] = useState<Record<string, CoachSessionSummary>>({});
	const [inviteCode, setInviteCode] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [statsReady, setStatsReady] = useState(true);
	const [signedOut, setSignedOut] = useState(false);
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const [sessionsByRow, setSessionsByRow] = useState<Record<string, CoachRecentSession[]>>({});
	const [revokeTarget, setRevokeTarget] = useState<CoachClientRow | null>(null);
	const [sessionOpen, setSessionOpen] = useState(false);
	const [sessionDetail, setSessionDetail] = useState<CoachSessionDetail | null>(null);
	const [sessionBusy, setSessionBusy] = useState(false);
	const [toast, setToast] = useState<string | null>(null);
	const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const rows = useMemo<CoachClientRow[]>(
		() =>
			links
				.filter((link) => link.coachUserId === me && link.status === 'active')
				.map((link) => ({
					key: link.id,
					label:
						link.note?.trim() ||
						`${tt('coach.clientFallback')} ${link.clientUserId.slice(0, 4).toUpperCase()}`,
					linkId: link.id,
					clientUserId: link.clientUserId,
					summary: stats[link.clientUserId] ?? emptySummary()
				}))
				.sort((a, b) =>
					(b.summary.lastSessionAt ?? '').localeCompare(a.summary.lastSessionAt ?? '')
				),
		[links, me, stats, tt]
	);

	const weekActive = rows.filter((row) => row.summary.sessions7d > 0).length;

	function errorText(reason: CoachErrorReason): string {
		return tt(`coach.error.${reason}`);
	}

	const showToast = useCallback((message: string) => {
		setToast(message);
		if (toastTimer.current) clearTimeout(toastTimer.current);
		toastTimer.current = setTimeout(() => setToast(null), 2200);
	}, []);

	useEffect(
		() => () => {
			if (toastTimer.current) clearTimeout(toastTimer.current);
		},
		[]
	);

	const refresh = useCallback(async () => {
		if (!cloud) return;
		const sb = getSupabase();
		const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
		const userId = data.session?.user?.id ?? '';
		setMe(userId);
		setSignedOut(!userId);
		if (!userId) {
			setLoaded(true);
			return;
		}
		const [linkRes, statsRes] = await Promise.all([coachRepo.listLinks(), coachRepo.stats()]);
		if (linkRes.ok) setLinks(linkRes.value);
		else showToast(tt(`coach.error.${linkRes.reason}`));
		if (statsRes.ok) {
			setStats(Object.fromEntries(statsRes.value.map((row) => [row.clientUserId, row.summary])));
			setStatsReady(true);
		} else {
			setStatsReady(false);
			if (statsRes.reason !== 'notConfigured') {
				showToast(tt(`coach.error.${statsRes.reason}`));
			}
		}
		setLoaded(true);
	}, [cloud, showToast, tt]);

	useFocusEffect(
		useCallback(() => {
			void refreshCustomsCache();
			if (!cloud || loaded) return;
			setBusy(true);
			void refresh().finally(() => setBusy(false));
		}, [cloud, loaded, refresh])
	);

	const reload = useCallback(async () => {
		setRefreshing(true);
		try {
			await refresh();
		} finally {
			setRefreshing(false);
		}
	}, [refresh]);

	async function createInvite(): Promise<string | null> {
		setBusy(true);
		try {
			const result = await coachRepo.createInvite();
			if (result.ok) {
				setInviteCode(result.value);
				return result.value;
			}
			showToast(errorText(result.reason));
			return null;
		} finally {
			setBusy(false);
		}
	}

	async function refreshInvite() {
		setInviteCode(null);
		await createInvite();
	}

	async function copyInvite() {
		if (!inviteCode) return;
		await Clipboard.setStringAsync(formatInviteCode(inviteCode));
		showToast(tt('coach.inviteCopied'));
	}

	async function shareInvite(inviteCodeArg?: string) {
		const source = inviteCodeArg ?? inviteCode;
		if (!source) return;
		const code = formatInviteCode(source);
		try {
			await Share.share({ message: tt('coach.inviteShareMessage', { code }) });
		} catch {
			await copyInvite();
		}
	}

	/** Empty state CTA: create the code if needed, then open the share sheet. */
	async function inviteFirstClient() {
		const code = inviteCode ?? (await createInvite());
		if (code) await shareInvite(code);
	}

	async function remind(name?: string) {
		try {
			await Share.share({ message: tt('coach.remindMessage', { name: name ?? '' }) });
		} catch {
			showToast(tt('coach.error.unknown'));
		}
	}

	async function toggleRow(row: CoachClientRow) {
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

	function closeSession() {
		setSessionOpen(false);
		setSessionDetail(null);
	}

	async function revokeRow(row: CoachClientRow) {
		setBusy(true);
		try {
			const result = await coachRepo.revoke(row.linkId);
			if (result.ok) await refresh();
			else showToast(errorText(result.reason));
		} finally {
			setBusy(false);
		}
	}

	function statusLine(summary: CoachSessionSummary): ClientStatus {
		if (summary.sessions === 0 || !summary.lastSessionAt) {
			return { text: tt('coach.never'), active: false };
		}
		const days = daysSinceLastSession(summary);
		if (days === 0) return { text: tt('coach.trainedToday'), active: true };
		if (days === 1) return { text: tt('coach.trainedYesterday'), active: false };
		if (days != null && days <= 7) {
			return { text: tt('coach.tierActive', { n: days }), active: false };
		}
		return { text: tt('coach.tierStale', { n: days ?? 0 }), active: false };
	}

	return {
		cloud,
		rows,
		weekActive,
		inviteCode,
		busy,
		refreshing,
		loaded,
		statsReady,
		signedOut,
		expanded,
		sessionsByRow,
		revokeTarget,
		setRevokeTarget,
		sessionOpen,
		sessionDetail,
		sessionBusy,
		toast,
		statusLine,
		reload,
		createInvite,
		refreshInvite,
		inviteFirstClient,
		copyInvite,
		shareInvite,
		remind,
		toggleRow,
		openSession,
		closeSession,
		revokeRow
	};
}

export type CoachClientsState = ReturnType<typeof useCoachClients>;
