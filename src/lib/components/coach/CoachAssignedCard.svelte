<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import IconPlate from '$lib/components/IconPlate.svelte';
	import type { CoachAssignment } from '$lib/domain/coach';
	import { translate, type Locale } from '$lib/i18n/messages';
	import { ClipboardText } from 'phosphor-svelte';

	type SecondaryAction = 'hide' | 'dismiss';

	type Props = {
		assignment: CoachAssignment;
		lang: Locale;
		busy?: boolean;
		/** Home uses Hide (local); Profile uses Dismiss (RPC discard). */
		secondary: SecondaryAction;
		onPrimary: () => void;
		onSecondary: () => void;
		/** Home wraps in `.panel`; Profile sits inside a settings group. */
		panel?: boolean;
	};

	let {
		assignment,
		lang,
		busy = false,
		secondary,
		onPrimary,
		onSecondary,
		panel = false
	}: Props = $props();

	const secondaryLabel = $derived(
		secondary === 'hide'
			? translate(lang, 'coach.assignedHide')
			: translate(lang, 'coach.assignedDismiss')
	);
</script>

<div class={panel ? 'panel coach-assigned-card' : 'coach-assigned-card'} class:coach-assigned-card--inset={!panel}>
	<div class="coach-assigned-card__head">
		<IconPlate icon={ClipboardText} tone="accent" />
		<div class="coach-assigned-card__copy">
			<p class="coach-assigned-card__kicker">{translate(lang, 'coach.assignedTitle')}</p>
			<p class="coach-assigned-card__title">{assignment.planName}</p>
			{#if assignment.coachName}
				<p class="coach-assigned-card__meta">{assignment.coachName}</p>
			{/if}
		</div>
	</div>
	<div class="coach-assigned-card__actions">
		<AppButton block disabled={busy} onclick={onPrimary}>
			{translate(lang, 'coach.assignedAdd')}
		</AppButton>
		<AppButton variant="ghost" disabled={busy} onclick={onSecondary}>
			{secondaryLabel}
		</AppButton>
	</div>
</div>

<style>
	.coach-assigned-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.85rem;
		border: 1px solid var(--color-accent-muted);
		border-radius: var(--radius-panel);
		background: var(--color-accent-muted);
	}

	.coach-assigned-card--inset {
		margin-top: 0.75rem;
	}

	.coach-assigned-card__head {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.coach-assigned-card__copy {
		min-width: 0;
		flex: 1;
	}

	.coach-assigned-card__kicker {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.3;
		color: var(--color-secondary);
	}

	.coach-assigned-card__title {
		margin: 0.15rem 0 0;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1.3;
		color: var(--color-ink);
		overflow-wrap: anywhere;
	}

	.coach-assigned-card__meta {
		margin: 0.15rem 0 0;
		font-size: 0.8125rem;
		line-height: 1.35;
		color: var(--color-muted);
	}

	.coach-assigned-card__actions {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
</style>
