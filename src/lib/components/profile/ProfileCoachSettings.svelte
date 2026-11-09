<script lang="ts">
	import { browser } from '$app/environment';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import CoachAssignedCard from '$lib/components/coach/CoachAssignedCard.svelte';
	import ConfirmSheet from '$lib/components/ConfirmSheet.svelte';
	import IconPlate from '$lib/components/IconPlate.svelte';
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import {
		COACH_ASSIGNMENT_HIDDEN_KEY,
		INVITE_CODE_LENGTH,
		isValidInviteCode,
		normalizeInviteCode,
		type CoachAssignment,
		type CoachMyCoach
	} from '$lib/domain/coach';
	import { formatRelativeDay } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { homeNextPlan } from '$lib/stores/homeNextPlan';
	import { resolvedLocale } from '$lib/stores/locale';
	import { plans } from '$lib/stores/plans';
	import { toasts } from '$lib/stores/toasts';
	import { coachRepository } from '$lib/storage/coachRepository';
	import { isSupabaseConfigured } from '$lib/supabase/client';
	import { User as UserRound, UserCheck, UserMinus, UsersThree } from 'phosphor-svelte';

	let lang = $derived($resolvedLocale);
	let coachCloud = $derived(isSupabaseConfigured() && Boolean($auth.user));
	let ownUserId = $derived($auth.user?.id ?? null);
	let myCoaches = $state<CoachMyCoach[]>([]);
	let clientCoachLoadedFor = $state<string | null>(null);
	let clientCoachLoading = $state(false);
	let clientCoachLoaded = $derived(Boolean(ownUserId) && clientCoachLoadedFor === ownUserId);
	let coachSheetOpen = $state(false);
	let coachInviteInput = $state('');
	let coachInviteBusy = $state(false);
	let coachInviteError = $state<string | null>(null);
	let coachInviteHasChars = $derived(normalizeInviteCode(coachInviteInput).length > 0);
	let disconnectTarget = $state<CoachMyCoach | null>(null);
	let disconnectBusy = $state(false);
	let currentAssignment = $state<CoachAssignment | null>(null);
	let assignmentLoadedFor = $state<string | null>(null);
	let assignmentBusy = $state(false);

	let coachRowValue = $derived(
		!clientCoachLoaded
			? '…'
			: myCoaches.length === 0
				? translate(lang, 'profile.coachNone')
				: myCoaches.length === 1
					? coachDisplayName(myCoaches[0]!)
					: translate(lang, 'profile.coachesConnected', { n: myCoaches.length })
	);

	$effect(() => {
		if (!coachCloud || !ownUserId || clientCoachLoaded || clientCoachLoading) return;
		void loadClientCoachLinks();
	});

	$effect(() => {
		if (!coachCloud || !ownUserId) return;
		void loadCurrentAssignment();
	});

	function coachDisplayName(coach: CoachMyCoach): string {
		return coach.coachName?.trim() || translate(lang, 'profile.coachFallback');
	}

	function clearHomeAssignmentHide() {
		if (browser) localStorage.removeItem(COACH_ASSIGNMENT_HIDDEN_KEY);
	}

	async function loadClientCoachLinks() {
		const userId = ownUserId;
		if (!coachCloud || !userId || clientCoachLoading) return;
		clientCoachLoading = true;
		try {
			const result = await coachRepository.listMyCoaches();
			if (result.ok) myCoaches = result.value;
			clientCoachLoadedFor = userId;
		} finally {
			clientCoachLoading = false;
		}
	}

	async function loadCurrentAssignment() {
		const userId = ownUserId;
		if (!coachCloud || !userId || assignmentLoadedFor === userId) return;
		const result = await coachRepository.myCurrentAssignment();
		if (result.ok) currentAssignment = result.value;
		assignmentLoadedFor = userId;
	}

	async function importAssignment() {
		const assignment = currentAssignment;
		if (!assignment || assignmentBusy) return;
		assignmentBusy = true;
		try {
			const { plan } = await plans.importPlan({
				name: assignment.planName,
				exercises: assignment.exercises
			});
			homeNextPlan.pin(plan.id);
			const discard = await coachRepository.discardAssignment();
			currentAssignment = null;
			clearHomeAssignmentHide();
			toasts.show(translate(lang, 'coach.assignedAdded'), 'success');
			if (!discard.ok) {
				toasts.show(translate(lang, `coach.error.${discard.reason}`), 'error');
			}
		} catch {
			toasts.show(translate(lang, 'coach.error.unknown'), 'error');
		} finally {
			assignmentBusy = false;
		}
	}

	async function dismissAssignment() {
		if (!currentAssignment || assignmentBusy) return;
		assignmentBusy = true;
		try {
			const result = await coachRepository.discardAssignment();
			if (result.ok) {
				currentAssignment = null;
				clearHomeAssignmentHide();
				toasts.show(translate(lang, 'coach.assignedDismissed'), 'info');
			} else {
				toasts.show(translate(lang, `coach.error.${result.reason}`), 'error');
			}
		} finally {
			assignmentBusy = false;
		}
	}

	function onCoachInviteInput(el: HTMLInputElement) {
		const cleaned = normalizeInviteCode(el.value).slice(0, INVITE_CODE_LENGTH);
		const next = cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned;
		coachInviteInput = next;
		coachInviteError = null;
		if (el.value !== next) el.value = next;
	}

	async function acceptCoachInvite() {
		if (coachInviteBusy) return;
		const code = normalizeInviteCode(coachInviteInput);
		if (!isValidInviteCode(code)) {
			coachInviteError = translate(lang, 'coach.inviteInvalid');
			return;
		}
		coachInviteError = null;
		coachInviteBusy = true;
		try {
			const result = await coachRepository.acceptInvite(code);
			if (result.ok) {
				coachInviteInput = '';
				coachSheetOpen = false;
				toasts.show(translate(lang, 'coach.inviteAccepted'), 'success');
				clientCoachLoadedFor = null;
				assignmentLoadedFor = null;
				void loadClientCoachLinks();
				void loadCurrentAssignment();
			} else {
				coachInviteError = translate(lang, `coach.error.${result.reason}`);
			}
		} finally {
			coachInviteBusy = false;
		}
	}

	async function disconnectCoach(coach: CoachMyCoach) {
		disconnectBusy = true;
		try {
			const result = await coachRepository.revokeAsClient(coach.linkId);
			if (result.ok) {
				myCoaches = myCoaches.filter((row) => row.linkId !== coach.linkId);
				clearHomeAssignmentHide();
				currentAssignment = null;
				toasts.show(translate(lang, 'coach.disconnectDone'), 'success');
				assignmentLoadedFor = null;
				void loadCurrentAssignment();
			} else {
				toasts.show(translate(lang, `coach.error.${result.reason}`), 'error');
			}
		} finally {
			disconnectBusy = false;
		}
	}
</script>

<div class="profile-settings-group panel text-left">
	<p class="profile-settings-group__title">{translate(lang, 'profile.clients')}</p>

	{#if currentAssignment}
		<CoachAssignedCard
			assignment={currentAssignment}
			{lang}
			busy={assignmentBusy}
			secondary="dismiss"
			onPrimary={() => void importAssignment()}
			onSecondary={() => void dismissAssignment()}
		/>
	{/if}

	<ProfileSettingsRow
		icon={myCoaches.length > 0 ? UserCheck : UserRound}
		iconTone={myCoaches.length > 0 ? 'accent' : 'muted'}
		label={translate(lang, 'profile.myCoach')}
		hint={coachRowValue || undefined}
		onclick={() => (coachSheetOpen = true)}
	/>
	<ProfileSettingsRow
		icon={UsersThree}
		label={translate(lang, 'profile.clientsRow')}
		href="/clients"
	/>
</div>

{#if $auth.user}
	<BottomSheet
		bind:open={coachSheetOpen}
		titleId="coach-my-title"
		label={translate(lang, 'profile.myCoach')}
		raised={myCoaches.length === 0}
		dismissible={!coachInviteBusy}
		onDismiss={() => (coachSheetOpen = false)}
	>
		<p id="coach-my-title" class="bottom-sheet__title">{translate(lang, 'profile.myCoach')}</p>
		{#if coachCloud && !clientCoachLoaded}
			<p class="bottom-sheet__hint">…</p>
		{:else if myCoaches.length > 0}
			<ul class="coach-my-list">
				{#each myCoaches as coach (coach.linkId)}
					<li class="coach-connect-status">
						<IconPlate icon={UserCheck} tone="accent" />
						<div class="coach-connect-status__text">
							<p class="coach-connect-status__title">{coachDisplayName(coach)}</p>
							<p class="coach-connect-status__hint">
								{translate(lang, 'coach.connectedOn', {
									when: formatRelativeDay(coach.createdAt, lang)
								})}
							</p>
							<p class="coach-connect-status__hint">
								{translate(lang, 'profile.coachConnectedHint')}
							</p>
						</div>
						<AppButton
							variant="ghost"
							size="icon"
							class="is-danger coach-connect-status__disconnect"
							aria-label={translate(lang, 'coach.disconnect')}
							disabled={disconnectBusy}
							onclick={() => {
								coachSheetOpen = false;
								disconnectTarget = coach;
							}}
						>
							<UserMinus weight="bold" />
						</AppButton>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="bottom-sheet__hint">{translate(lang, 'coach.inviteAcceptLead')}</p>
			<form
				class="coach-connect-form"
				onsubmit={(e) => {
					e.preventDefault();
					void acceptCoachInvite();
				}}
			>
				<AppInput
					type="text"
					inputmode="text"
					autocomplete="off"
					autocapitalize="characters"
					enterkeyhint="done"
					maxlength={INVITE_CODE_LENGTH + 1}
					spellcheck={false}
					class="w-full font-mono tracking-[0.12em]"
					placeholder={translate(lang, 'coach.inviteAcceptPlaceholder')}
					aria-label={translate(lang, 'coach.inviteAcceptLabel')}
					aria-invalid={coachInviteError ? 'true' : undefined}
					aria-describedby={coachInviteError ? 'coach-invite-error' : undefined}
					value={coachInviteInput}
					oninput={(e) => onCoachInviteInput(e.currentTarget)}
				/>
				<AppButton type="submit" block disabled={coachInviteBusy || !coachInviteHasChars}>
					{#if coachInviteBusy}
						<span class="inline-flex items-center gap-2">
							<Spinner size="sm" block={false} />
							{translate(lang, 'auth.wait')}
						</span>
					{:else}
						{translate(lang, 'coach.inviteAcceptCta')}
					{/if}
				</AppButton>
			</form>
			{#if coachInviteError}
				<p id="coach-invite-error" class="coach-connect-form__error" role="alert">
					{coachInviteError}
				</p>
			{/if}
		{/if}
	</BottomSheet>
	<ConfirmSheet
		open={disconnectTarget !== null}
		titleId="coach-disconnect-title"
		title={translate(lang, 'coach.disconnectConfirmTitle')}
		hint={translate(lang, 'coach.disconnectConfirmLead', {
			name: disconnectTarget ? coachDisplayName(disconnectTarget) : '-'
		})}
		confirmLabel={translate(lang, 'coach.disconnect')}
		variant="danger"
		busy={disconnectBusy}
		onConfirm={() => {
			const target = disconnectTarget;
			disconnectTarget = null;
			if (target) void disconnectCoach(target);
		}}
		onDismiss={() => {
			if (!disconnectBusy) disconnectTarget = null;
		}}
	/>
{/if}
