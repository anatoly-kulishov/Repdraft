<script lang="ts">
	import '$lib/styles/blocks/coach.css';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';
	import CoachAssignSheet from '$lib/components/coach/CoachAssignSheet.svelte';
	import CoachSessionDetailSheet from '$lib/components/coach/CoachSessionDetailSheet.svelte';
	import ConfirmSheet from '$lib/components/ConfirmSheet.svelte';
	import HelpButton from '$lib/components/HelpButton.svelte';
	import HelpPanel from '$lib/components/HelpPanel.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { loadExerciseIndexWithCustoms } from '$lib/data/exerciseIndexWithCustoms';
	import {
		clientInitials,
		daysSinceLastSession,
		formatInviteCode,
		type CoachAssignablePlan,
		type CoachClientLink,
		type CoachSessionDetail,
		type CoachSessionSummary
	} from '$lib/domain/coach';
	import { formatKgInt } from '$lib/domain/format';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { formatRelativeDayShort } from '$lib/i18n/format';
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
	import {
		ChartLineUp,
		Check,
		ChatCircle,
		Copy,
		Gear,
		ShareNetwork,
		UsersThree
	} from 'phosphor-svelte';

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
	let cloudStatsReady = $state(true);
	let inviteMenuOpen = $state(false);
	let inviteCopied = $state(false);
	let inviteCopiedTimer: ReturnType<typeof setTimeout> | null = null;
	let helpOpen = $state(false);
	let refreshTarget = $state(false);

	let expanded = $state<Record<string, boolean>>({});
	let revokeTarget = $state<Row | null>(null);
	let removeTarget = $state<Row | null>(null);

	let sessionSheetOpen = $state(false);
	let sessionDetail = $state<CoachSessionDetail | null>(null);
	let sessionBusy = $state(false);
	let indexById = $state<Map<string, ExerciseIndexItem>>(new Map());

	let assignTarget = $state<Row | null>(null);
	let assignPlans = $state<CoachAssignablePlan[]>([]);
	let assignLoading = $state(false);
	let assignBusy = $state(false);

	let rows = $derived.by<Row[]>(() => {
		if (!cloud) {
			return coachClientRows($coachPreviewState.clients).map((row) => {
				const last = [...row.client.sessions]
					.filter((s) => s.finishedAt)
					.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))[0];
				return {
					key: row.client.link.clientUserId,
					label: row.client.displayName,
					linkId: null,
					clientUserId: row.client.link.clientUserId,
					summary: {
						...row.summary,
						lastSessionId: last?.id ?? null,
						lastPlanName: last?.planName ?? null
					}
				};
			});
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
	let statsReady = $derived(!cloud || cloudStatsReady);
	let clientQuery = $state('');
	let filteredRows = $derived.by(() => {
		const needle = clientQuery.trim().toLowerCase();
		return needle
			? rows.filter((row) => row.label.toLowerCase().includes(needle))
			: rows;
	});

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
			activeRecently: false,
			lastSessionId: null,
			lastPlanName: null
		};
	}

	function errorText(reason: CoachErrorReason): string {
		return translate(lang, `coach.error.${reason}`);
	}

	async function ensureIndex() {
		if (indexById.size > 0) return;
		const list = await loadExerciseIndexWithCustoms();
		indexById = new Map(list.map((item) => [item.id, item]));
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
				cloudStatsReady = true;
			} else {
				cloudStatsReady = false;
				if (stats.reason !== 'notConfigured') {
					toasts.show(errorText(stats.reason), 'error');
				}
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
			inviteCopied = true;
			if (inviteCopiedTimer) clearTimeout(inviteCopiedTimer);
			inviteCopiedTimer = setTimeout(() => (inviteCopied = false), 1500);
		} catch {
			toasts.show(translate(lang, 'coach.inviteCopyFail'), 'error');
		}
	}

	async function shareInvite() {
		const code = inviteCode;
		if (!code) return;
		const text = translate(lang, 'coach.inviteShareMessage', {
			code: formatInviteCode(code)
		});
		try {
			if (typeof navigator !== 'undefined' && navigator.share) {
				await navigator.share({ text });
				return;
			}
			await navigator.clipboard.writeText(text);
			toasts.show(translate(lang, 'coach.inviteCopied'), 'success');
		} catch {
			/* user dismissed the share sheet */
		}
	}

	async function remind(row: Row) {
		const text = translate(lang, 'coach.remindMessage', { name: row.label });
		try {
			if (typeof navigator !== 'undefined' && navigator.share) {
				await navigator.share({ text });
				return;
			}
			await navigator.clipboard.writeText(text);
			toasts.show(translate(lang, 'coach.remind'), 'success');
		} catch {
			/* user dismissed the share sheet */
		}
	}

	function requestRefresh() {
		inviteMenuOpen = false;
		refreshTarget = true;
	}

	async function confirmRefresh() {
		refreshTarget = false;
		if (!cloud) {
			coachPreview.refreshInvite();
			return;
		}
		await refreshInvite();
	}

	function rowStatus(summary: CoachSessionSummary) {
		if (!statsReady) {
			return {
				key: 'coach.noStats' as const,
				vars: {} as Record<string, string | number>,
				tone: 'neutral' as const
			};
		}
		return statusLine(summary);
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
		const result = await coachRepository.recentSessions(row.clientUserId, 5);
		if (result.ok) cloudSessions = { ...cloudSessions, [row.key]: result.value };
		else toasts.show(errorText(result.reason), 'error');
	}

	async function openSession(sessionId: string | null | undefined, clientUserId: string) {
		if (!sessionId) return;
		sessionSheetOpen = true;
		sessionDetail = null;
		sessionBusy = true;
		try {
			await ensureIndex();
			if (!cloud) {
				const client = $coachPreviewState.clients.find(
					(entry) => entry.link.clientUserId === clientUserId
				);
				const session = client?.sessions.find((s) => s.id === sessionId);
				if (!session?.finishedAt) {
					toasts.show(errorText('notFound'), 'error');
					sessionSheetOpen = false;
					return;
				}
				sessionDetail = {
					id: session.id,
					clientUserId,
					planName: session.planName,
					startedAt: session.startedAt,
					finishedAt: session.finishedAt,
					exercises: session.exercises
				};
				return;
			}
			const result = await coachRepository.sessionDetail(sessionId);
			if (result.ok) sessionDetail = result.value;
			else {
				toasts.show(errorText(result.reason), 'error');
				sessionSheetOpen = false;
			}
		} finally {
			sessionBusy = false;
		}
	}

	function dismissSessionSheet() {
		sessionSheetOpen = false;
		sessionDetail = null;
	}

	async function openAssign(row: Row) {
		assignTarget = row;
		assignPlans = [];
		assignLoading = true;
		try {
			const result = await coachRepository.listAssignablePlans();
			if (result.ok) assignPlans = result.value;
			else toasts.show(errorText(result.reason), 'error');
		} finally {
			assignLoading = false;
		}
	}

	function dismissAssign() {
		if (assignBusy) return;
		assignTarget = null;
		assignPlans = [];
	}

	async function pickAssign(plan: CoachAssignablePlan) {
		const target = assignTarget;
		if (!target || assignBusy) return;
		assignBusy = true;
		try {
			const result = await coachRepository.assignPlan(target.clientUserId, plan.planId);
			if (result.ok) {
				toasts.show(translate(lang, 'coach.assignDone'), 'success');
				assignTarget = null;
				assignPlans = [];
			} else {
				toasts.show(errorText(result.reason), 'error');
			}
		} finally {
			assignBusy = false;
		}
	}

	/** Two-state status: today (green with dot) or a calm grey line. */
	function statusLine(summary: CoachSessionSummary) {
		if (summary.sessions === 0 || !summary.lastSessionAt) {
			return {
				key: 'coach.never' as const,
				vars: {} as Record<string, string | number>,
				tone: 'neutral' as const
			};
		}
		const days = daysSinceLastSession(summary);
		if (days === 0) {
			return {
				key: 'coach.trainedToday' as const,
				vars: {} as Record<string, string | number>,
				tone: 'active' as const
			};
		}
		if (days === 1) {
			return {
				key: 'coach.trainedYesterday' as const,
				vars: {} as Record<string, string | number>,
				tone: 'neutral' as const
			};
		}
		if (days != null && days <= 7) {
			return {
				key: 'coach.tierActive' as const,
				vars: { n: days },
				tone: 'neutral' as const
			};
		}
		return {
			key: 'coach.tierStale' as const,
			vars: { n: days ?? 0 },
			tone: 'neutral' as const
		};
	}

	function previewSessions(clientUserId: string): CoachRecentSession[] {
		const client = $coachPreviewState.clients.find(
			(entry) => entry.link.clientUserId === clientUserId
		);
		if (!client) return [];
		return [...client.sessions]
			.filter((session) => session.finishedAt)
			.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
			.slice(0, 5)
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

<section class="content-page content-page--narrow coach-page">
	<ScreenHeader
		title={translate(lang, 'coach.pageTitle')}
		backHref="/auth"
		backLabelVisible
		backLabel={translate(lang, 'nav.profile')}
		preferHistoryBack={false}
	>
		{#snippet actions()}
			<HelpButton label={translate(lang, 'coach.help')} bind:open={helpOpen} />
			<a class="coach-icon-btn" href="/auth" aria-label={translate(lang, 'coach.settings')}>
				<Gear size={22} />
			</a>
		{/snippet}
	</ScreenHeader>

	<HelpPanel
		open={helpOpen}
		title={translate(lang, 'coach.helpTitle')}
		body={translate(lang, 'coach.helpBody')}
	/>

	<div class="coach-layout">
	<div class="coach-column">
	<div class="coach-block">
		<h2 class="coach-block-title">{translate(lang, 'coach.inviteTitle')}</h2>
		<div class="panel coach-card">
			<div class="coach-card-top">
				<span class="coach-hint">{translate(lang, 'coach.inviteHint')}</span>
				{#if inviteCode}
					<button
						type="button"
						class="coach-more"
						aria-label={translate(lang, 'coach.more')}
						aria-expanded={inviteMenuOpen}
						onclick={() => (inviteMenuOpen = !inviteMenuOpen)}
					>
						⋮
					</button>
				{/if}
			</div>

			{#if inviteCode}
				<div class="coach-code-row">
					<div class="coach-code-plate">
						<span class="coach-code">{formatInviteCode(inviteCode)}</span>
						<button
							type="button"
							class="coach-copy"
							aria-label={translate(lang, 'coach.inviteCopy')}
							onclick={() => void copyInvite()}
						>
							{#if inviteCopied}
								<Check size={20} />
							{:else}
								<Copy size={20} />
							{/if}
						</button>
					</div>
					<button
						type="button"
						class="coach-share"
						aria-label={translate(lang, 'coach.inviteShare')}
						onclick={() => void shareInvite()}
					>
						<ShareNetwork size={20} />
					</button>
				</div>
				<p class="coach-hint">{translate(lang, 'coach.inviteHelp')}</p>
			{:else}
				<AppButton block disabled={cloudBusy} onclick={() => void createInvite()}>
					{translate(lang, 'coach.inviteCreateShort')}
				</AppButton>
			{/if}

			{#if inviteMenuOpen}
				<div class="coach-menu">
					<button type="button" class="coach-menu-item" onclick={() => void copyInvite()}>
						{translate(lang, 'coach.inviteCopy')}
					</button>
					<button
						type="button"
						class="coach-menu-item coach-menu-item--danger"
						disabled={cloudBusy}
						onclick={requestRefresh}
					>
						{translate(lang, 'coach.inviteRefresh')}
					</button>
				</div>
			{/if}
		</div>
	</div>

	</div>
	<div class="coach-column">
	{#if cloudBusy && !cloudLoaded}
		<div class="coach-skeleton" aria-busy="true" aria-live="polite">
			<span class="sr-only">{translate(lang, 'common.loading')}</span>
			{#each [0, 1, 2] as row (row)}
				<div class="coach-skeleton__row" aria-hidden="true">
					<AppSkeleton class="coach-skeleton__avatar" />
					<div class="coach-skeleton__copy">
						<AppSkeleton class="coach-skeleton__name" />
						<AppSkeleton class="coach-skeleton__meta" />
					</div>
					<AppSkeleton class="coach-skeleton__chip" />
				</div>
			{/each}
		</div>
	{:else if rows.length === 0}
		<div class="panel coach-empty">
			<span class="coach-empty__icon"><UsersThree size={28} /></span>
			<p class="coach-empty__title">{translate(lang, 'coach.emptyTitle')}</p>
			<p class="coach-hint coach-empty__body">{translate(lang, 'coach.emptyBody')}</p>
			{#if inviteCode}
				<AppButton variant="secondary" onclick={() => void shareInvite()}>
					{translate(lang, 'coach.inviteShare')}
				</AppButton>
			{:else}
				<AppButton disabled={cloudBusy} onclick={() => void createInvite()}>
					{translate(lang, 'coach.inviteCreateShort')}
				</AppButton>
			{/if}
			{#if !cloud}
				<AppButton variant="secondary" onclick={() => coachPreview.addDemoClient()}>
					{translate(lang, 'coach.addDemo')}
				</AppButton>
			{/if}
		</div>
	{:else}
		<div class="coach-block">
			<div class="coach-list-head">
				<h2 class="coach-block-title">
					{translate(lang, 'coach.clientsCount', { n: rows.length })}
				</h2>
				<span class="coach-week">
					{statsReady ? translate(lang, 'coach.weekActive', { n: weekActive }) : '—'}
				</span>
			</div>
			{#if rows.length > 4}
				<input
					class="coach-search"
					type="search"
					bind:value={clientQuery}
					placeholder={translate(lang, 'coach.searchPlaceholder')}
					aria-label={translate(lang, 'coach.searchPlaceholder')}
				/>
			{/if}
			{#if filteredRows.length === 0}
				<p class="coach-hint coach-no-matches">{translate(lang, 'coach.noMatches')}</p>
			{:else}
			<ul class="panel coach-list">
				{#each filteredRows as row, idx (row.key)}
					{@const status = rowStatus(row.summary)}
					{@const isOpen = expanded[row.key] ?? false}
					{@const activeWeek = row.summary.sessions7d > 0}
					{@const recent = sessionsFor(row)}
					<li class="coach-row" class:coach-row--divider={idx > 0}>
						<div class="coach-row-main">
							<button
								type="button"
								class="coach-row-open"
								aria-expanded={isOpen}
								onclick={() => void toggleRow(row)}
							>
								<span class="coach-avatar">{clientInitials(row.label)}</span>
								<span class="coach-row-copy">
									<span class="coach-name">{row.label}</span>
									<span
										class="coach-status"
										class:coach-status--active={status.tone === 'active'}
									>
										{#if status.tone === 'active'}
											<span class="coach-dot" aria-hidden="true"></span>
										{/if}
										{translate(lang, status.key, status.vars)}
									</span>
									{#if row.summary.lastPlanName && row.summary.lastSessionAt}
										<span class="coach-row-last">
											{translate(lang, 'coach.lastSessionShort', {
												name: row.summary.lastPlanName
											})}
											· {formatRelativeDayShort(row.summary.lastSessionAt, lang)}
										</span>
									{/if}
								</span>
							</button>
							<button
								type="button"
								class="coach-chip"
								onclick={() => {
									if (!activeWeek) {
										void remind(row);
										return;
									}
									if (row.summary.lastSessionId) {
										void openSession(row.summary.lastSessionId, row.clientUserId);
									} else void toggleRow(row);
								}}
							>
								{#if activeWeek}
									<ChartLineUp size={18} />
									<span>{translate(lang, 'coach.results')}</span>
								{:else}
									<ChatCircle size={18} />
									<span>{translate(lang, 'coach.remind')}</span>
								{/if}
							</button>
						</div>

						{#if isOpen}
							<div class="coach-expanded">
								<p class="coach-hint">
									{translate(lang, 'coach.totalsLine', {
										sessions: row.summary.sessions,
										sets: row.summary.sets,
										kg: formatKgInt(row.summary.volumeKg)
									})}
								</p>
								{#if recent.length === 0}
									<p class="coach-hint">{translate(lang, 'coach.sessionDetailEmpty')}</p>
								{:else}
									{#each recent as session (session.id)}
										<button
											type="button"
											class="coach-session"
											onclick={() => void openSession(session.id, row.clientUserId)}
										>
											<span class="coach-session__name">
												{session.planName ||
													translate(lang, 'coach.sessionDetailTitle')}
											</span>
											<span class="coach-session__meta tabular-nums">
												{translate(lang, 'coach.sessionMeta', {
													when: formatRelativeDayShort(session.finishedAt, lang),
													sets: session.sets,
													volume: formatKgInt(session.volumeKg)
												})}
											</span>
										</button>
									{/each}
								{/if}
								<div class="coach-expanded__actions">
									{#if cloud}
										<AppButton
											variant="secondary"
											disabled={cloudBusy}
											onclick={() => void openAssign(row)}
										>
											{translate(lang, 'coach.assign')}
										</AppButton>
									{/if}
									<AppButton
										variant="ghost"
										class="is-danger"
										disabled={cloudBusy}
										onclick={() => requestRevoke(row)}
									>
										{translate(lang, 'coach.revoke')}
									</AppButton>
									{#if !cloud}
										<AppButton
											variant="ghost"
											class="is-danger"
											onclick={() => requestRemove(row)}
										>
											{translate(lang, 'coach.remove')}
										</AppButton>
									{/if}
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
			{/if}
		</div>
		{#if !cloud}
			<AppButton variant="secondary" block onclick={() => coachPreview.addDemoClient()}>
				{translate(lang, 'coach.addDemo')}
			</AppButton>
		{/if}
	{/if}
	</div>
	</div>
</section>

<CoachAssignSheet
	open={assignTarget !== null}
	clientLabel={assignTarget?.label ?? ''}
	loading={assignLoading}
	busy={assignBusy}
	plans={assignPlans}
	onPick={(plan) => void pickAssign(plan)}
	onDismiss={dismissAssign}
/>

<CoachSessionDetailSheet
	open={sessionSheetOpen}
	detail={sessionDetail}
	busy={sessionBusy}
	{indexById}
	onDismiss={dismissSessionSheet}
/>

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
	open={refreshTarget}
	titleId="coach-refresh-title"
	title={translate(lang, 'coach.inviteRefreshConfirmTitle')}
	hint={translate(lang, 'coach.inviteRefreshConfirmLead')}
	confirmLabel={translate(lang, 'coach.inviteRefresh')}
	busy={cloudBusy}
	onConfirm={() => void confirmRefresh()}
	onDismiss={() => (refreshTarget = false)}
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
