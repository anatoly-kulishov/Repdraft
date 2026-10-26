<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import ConfirmSheet from '$lib/components/ConfirmSheet.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import {
		clientActivityTier,
		daysSinceLastSession,
		formatInviteCode,
		type CoachClientLink,
		type CoachSessionSummary
	} from '$lib/domain/coach';
	import { formatRelativeDay } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import { isSupabaseConfigured } from '$lib/supabase/client';
	import { auth } from '$lib/stores/auth';
	import { coachClientRows, coachPreview, coachPreviewState } from '$lib/stores/coach';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import {
		coachRepository,
		type CoachClientStatsRow,
		type CoachErrorReason,
		type CoachRecentSession
	} from '$lib/storage/coachRepository';
	import { Copy } from 'phosphor-svelte';

	type Row = {
		key: string;
		label: string;
		linkId: string | null;
		clientUserId: string;
		summary: CoachSessionSummary;
	};

	let lang = $derived($resolvedLocale);
	let cloud = $derived(isSupabaseConfigured() && Boolean($auth.user));
	let me = $derived($auth.user?.id ?? '');

	let cloudLinks = $state<CoachClientLink[]>([]);
	let cloudStats = $state<Record<string, CoachSessionSummary>>({});
	let cloudInvite = $state<string | null>(null);
	let cloudSessions = $state<Record<string, CoachRecentSession[]>>({});
	let cloudBusy = $state(false);
	let cloudLoaded = $state(false);

	let expanded = $state<Record<string, boolean>>({});
	let revokeTarget = $state<Row | null>(null);
	let removeTarget = $state<Row | null>(null);

	let rows = $derived.by<Row[]>(() => {
		if (!cloud) {
			return coachClientRows($coachPreviewState.clients).map((row) => ({
				key: row.client.link.clientUserId,
				label: row.client.displayName,
				linkId: null,
				clientUserId: row.client.link.clientUserId,
				summary: row.summary
			}));
		}
		return cloudLinks
			.filter((link) => link.coachUserId === me && link.status === 'active')
			.map((link) => ({
				key: link.id,
				label: link.note?.trim() || shortId(link.clientUserId),
				linkId: link.id,
				clientUserId: link.clientUserId,
				summary: cloudStats[link.clientUserId] ?? emptySummary()
			}))
			.sort((a, b) => (b.summary.lastSessionAt ?? '').localeCompare(a.summary.lastSessionAt ?? ''));
	});

	let inviteCode = $derived(cloud ? cloudInvite : $coachPreviewState.inviteCode);
	let weekActive = $derived(rows.filter((row) => row.summary.sessions7d > 0).length);

	function shortId(id: string): string {
		return `${translate(lang, 'coach.clientFallback')} ${id.slice(0, 4).toUpperCase()}`;
	}

	function emptySummary(): CoachSessionSummary {
		return {
			sessions: 0,
			sets: 0,
			volumeKg: 0,
			lastSessionAt: null,
			sessions7d: 0,
			activeRecently: false
		};
	}

	function errorText(reason: CoachErrorReason): string {
		return translate(lang, `coach.error.${reason}`);
	}

	async function loadCloud() {
		if (!cloud || cloudBusy) return;
		cloudBusy = true;
		try {
			const [links, stats] = await Promise.all([
				coachRepository.listLinks(),
				coachRepository.stats()
			]);
			if (links.ok) cloudLinks = links.value;
			else toasts.show(errorText(links.reason), 'error');
			if (stats.ok) {
				cloudStats = Object.fromEntries(
					stats.value.map((row: CoachClientStatsRow) => [row.clientUserId, row.summary])
				);
			} else if (stats.reason !== 'notConfigured') {
				toasts.show(errorText(stats.reason), 'error');
			}
			cloudLoaded = true;
		} finally {
			cloudBusy = false;
		}
	}

	$effect(() => {
		if (cloud && !cloudLoaded) void loadCloud();
	});

	async function createInvite() {
		if (!cloud) {
			coachPreview.createInvite();
			return;
		}
		cloudBusy = true;
		try {
			const result = await coachRepository.createInvite();
			if (result.ok) cloudInvite = result.value;
			else toasts.show(errorText(result.reason), 'error');
		} finally {
			cloudBusy = false;
		}
	}

	async function refreshInvite() {
		if (!cloud) {
			coachPreview.refreshInvite();
			return;
		}
		cloudInvite = null;
		await createInvite();
	}

	async function copyInvite() {
		const code = inviteCode;
		if (!code) return;
		try {
			await navigator.clipboard.writeText(formatInviteCode(code));
			toasts.show(translate(lang, 'coach.inviteCopied'), 'success');
		} catch {
			toasts.show(translate(lang, 'coach.inviteCopyFail'), 'error');
		}
	}

	function requestRevoke(row: Row) {
		if (cloudBusy) return;
		revokeTarget = row;
	}

	function dismissRevoke() {
		revokeTarget = null;
	}

	function confirmRevoke() {
		const target = revokeTarget;
		revokeTarget = null;
		if (target) void revokeRow(target);
	}

	function requestRemove(row: Row) {
		removeTarget = row;
	}

	function dismissRemove() {
		removeTarget = null;
	}

	function confirmRemove() {
		const target = removeTarget;
		removeTarget = null;
		if (target) coachPreview.remove(target.clientUserId);
	}

	async function revokeRow(row: Row) {
		if (!cloud) {
			coachPreview.revoke(row.clientUserId);
			return;
		}
		if (!row.linkId) return;
		cloudBusy = true;
		try {
			const result = await coachRepository.revoke(row.linkId);
			if (result.ok) await loadCloud();
			else toasts.show(errorText(result.reason), 'error');
		} finally {
			cloudBusy = false;
		}
	}

	async function toggleRow(row: Row) {
		const next = !(expanded[row.key] ?? false);
		expanded = { ...expanded, [row.key]: next };
		if (!cloud || !next || cloudSessions[row.key]) return;
		const result = await coachRepository.recentSessions(row.clientUserId, 3);
		if (result.ok) cloudSessions = { ...cloudSessions, [row.key]: result.value };
		else toasts.show(errorText(result.reason), 'error');
	}

	function tierChip(summary: CoachSessionSummary) {
		const tier = clientActivityTier(summary);
		const days = daysSinceLastSession(summary);
		if (tier === 'silent') {
			return { key: 'coach.tierSilent', vars: {} as Record<string, string | number>, tone: 'stale' as const };
		}
		if (tier === 'active') {
			return { key: 'coach.tierActive', vars: { n: days ?? 0 }, tone: 'active' as const };
		}
		if (tier === 'calm') {
			return { key: 'coach.tierCalm', vars: { n: days ?? 0 }, tone: 'calm' as const };
		}
		return { key: 'coach.tierStale', vars: { n: days ?? 0 }, tone: 'stale' as const };
	}

	function previewSessions(clientUserId: string): CoachRecentSession[] {
		const client = $coachPreviewState.clients.find(
			(entry) => entry.link.clientUserId === clientUserId
		);
		if (!client) return [];
		return [...client.sessions]
			.filter((session) => session.finishedAt)
			.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
			.slice(0, 3)
			.map((session) => {
				const done = session.exercises.flatMap((ex) => ex.sets).filter((set) => set.completed);
				const volume = done.reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.reps ?? 0), 0);
				return {
					id: session.id,
					planName: session.planName,
					finishedAt: session.finishedAt ?? '',
					sets: done.length,
					volumeKg: Math.round(volume)
				};
			});
	}

	function sessionsFor(row: Row): CoachRecentSession[] {
		return cloud ? (cloudSessions[row.key] ?? []) : previewSessions(row.clientUserId);
	}
</script>

<SeoHead title={translate(lang, 'coach.pageTitle')} noindex />

<section class="content-page content-page--narrow">
	<ScreenHeader
		title={translate(lang, 'coach.pageTitle')}
		backHref="/auth"
		backLabelVisible
		backLabel={translate(lang, 'nav.profile')}
		preferHistoryBack={false}
	/>

	<AppPanel class="mt-4 text-left">
		<p class="text-xs uppercase tracking-wide text-[var(--color-muted)]">
			{translate(lang, cloud ? 'coach.cloudBadge' : 'coach.previewBadge')}
		</p>
		<p class="mt-1 text-sm text-[var(--color-muted)]">
			{translate(lang, cloud ? 'coach.cloudLead' : 'coach.pageLead')}
		</p>
	</AppPanel>

	<AppPanel class="mt-4 text-left">
		<h2 class="text-base font-bold">{translate(lang, 'coach.inviteTitle')}</h2>
		<p class="mt-1 text-sm text-[var(--color-muted)]">{translate(lang, 'coach.inviteLead')}</p>
		{#if inviteCode}
			<p class="mt-3 font-mono text-2xl font-bold tracking-[0.18em] tabular-nums">
				{formatInviteCode(inviteCode)}
			</p>
			<div class="mt-3 flex flex-wrap gap-2">
				<AppButton variant="secondary" onclick={() => void copyInvite()}>
					<span class="inline-flex items-center gap-2">
						<Copy size={16} />
						{translate(lang, 'coach.inviteCopy')}
					</span>
				</AppButton>
				<AppButton variant="link" onclick={() => void refreshInvite()}>
					{translate(lang, 'coach.inviteRefresh')}
				</AppButton>
			</div>
		{:else}
			<AppButton class="mt-3" disabled={cloudBusy} onclick={() => void createInvite()}>
				{translate(lang, 'coach.inviteCreate')}
			</AppButton>
		{/if}
	</AppPanel>

	<div class="mt-6 flex items-center justify-between">
		<h2 class="section-title">{translate(lang, 'coach.clientsTitle')}</h2>
		<span class="text-sm text-[var(--color-muted)]">{rows.length}</span>
	</div>
	{#if rows.length > 0}
		<p class="mt-1 text-sm text-[var(--color-muted)]">
			{translate(lang, 'coach.summaryLine', { total: rows.length, week: weekActive })}
		</p>
	{/if}

	{#if rows.length === 0}
		<AppPanel class="mt-3 text-left">
			<p class="text-base font-semibold">{translate(lang, 'coach.clientsEmpty')}</p>
			<p class="mt-1 text-sm text-[var(--color-muted)]">
				{translate(lang, cloud ? 'coach.clientsEmptyCloud' : 'coach.clientsEmptyLead')}
			</p>
			{#if !cloud}
				<AppButton class="mt-3" variant="secondary" onclick={() => coachPreview.addDemoClient()}>
					{translate(lang, 'coach.addDemo')}
				</AppButton>
			{/if}
		</AppPanel>
	{:else}
		<ul class="mt-3 flex list-none flex-col gap-3 p-0">
			{#each rows as row (row.key)}
				{@const chip = tierChip(row.summary)}
				{@const isOpen = expanded[row.key] ?? false}
				<li>
					<AppPanel class="text-left">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="truncate text-base font-bold">{row.label}</p>
								<p class="mt-1 text-sm text-[var(--color-muted)]">
									{row.summary.lastSessionAt
										? translate(lang, 'coach.lastSession', {
												when: formatRelativeDay(row.summary.lastSessionAt, lang)
											})
										: translate(lang, 'coach.never')}
								</p>
							</div>
							<span
								class="shrink-0 rounded-full px-2 py-1 text-xs font-semibold {chip.tone === 'active'
									? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
									: chip.tone === 'stale'
										? 'bg-[var(--color-panel)] text-[var(--color-danger)]'
										: 'bg-[var(--color-panel)] text-[var(--color-muted)]'}"
							>
								{translate(lang, chip.key, chip.vars)}
							</span>
						</div>

						<dl class="mt-3 grid grid-cols-3 gap-2">
							<div>
								<dt class="text-xs text-[var(--color-muted)]">{translate(lang, 'coach.statWeek')}</dt>
								<dd class="text-lg font-bold tabular-nums">{row.summary.sessions7d}</dd>
							</div>
							<div>
								<dt class="text-xs text-[var(--color-muted)]">{translate(lang, 'coach.statSets')}</dt>
								<dd class="text-lg font-bold tabular-nums">{row.summary.sets}</dd>
							</div>
							<div>
								<dt class="text-xs text-[var(--color-muted)]">{translate(lang, 'coach.statVolume')}</dt>
								<dd class="text-lg font-bold tabular-nums">
									{row.summary.volumeKg.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB')}
								</dd>
							</div>
						</dl>

						<div class="mt-3 flex gap-2">
							<AppButton variant="link" onclick={() => void toggleRow(row)} aria-expanded={isOpen}>
								{translate(lang, isOpen ? 'coach.hideSessions' : 'coach.showSessions')}
							</AppButton>
							<AppButton variant="link" disabled={cloudBusy} onclick={() => requestRevoke(row)}>
								{translate(lang, 'coach.revoke')}
							</AppButton>
							{#if !cloud}
								<AppButton variant="link" onclick={() => requestRemove(row)}>
									{translate(lang, 'coach.remove')}
								</AppButton>
							{/if}
						</div>

						{#if isOpen}
							<ul class="mt-2 flex list-none flex-col gap-1 p-0">
								{#each sessionsFor(row) as session (session.id)}
									<li
										class="flex items-center justify-between gap-2 border-t border-[var(--color-border)] py-2 text-sm"
									>
										<span class="min-w-0 truncate font-semibold">{session.planName}</span>
										<span class="shrink-0 text-[var(--color-muted)] tabular-nums">
											{translate(lang, 'coach.sessionMeta', {
												when: formatRelativeDay(session.finishedAt, lang),
												sets: session.sets,
												volume: session.volumeKg.toLocaleString(
													lang === 'ru' ? 'ru-RU' : 'en-GB'
												)
											})}
										</span>
									</li>
								{/each}
							</ul>
						{/if}
					</AppPanel>
				</li>
			{/each}
		</ul>
		{#if !cloud}
			<AppButton class="mt-3" variant="secondary" block onclick={() => coachPreview.addDemoClient()}>
				{translate(lang, 'coach.addDemo')}
			</AppButton>
		{/if}
	{/if}
</section>

<ConfirmSheet
	open={revokeTarget !== null}
	titleId="coach-revoke-title"
	title={translate(lang, 'coach.revokeConfirmTitle')}
	hint={translate(lang, 'coach.revokeConfirmLead', { name: revokeTarget?.label ?? '' })}
	confirmLabel={translate(lang, 'coach.revoke')}
	busy={cloudBusy}
	onConfirm={confirmRevoke}
	onDismiss={dismissRevoke}
/>

<ConfirmSheet
	open={removeTarget !== null}
	titleId="coach-remove-title"
	title={translate(lang, 'coach.removeConfirmTitle')}
	hint={translate(lang, 'coach.removeConfirmLead', { name: removeTarget?.label ?? '' })}
	confirmLabel={translate(lang, 'coach.remove')}
	onConfirm={confirmRemove}
	onDismiss={dismissRemove}
/>
