<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import type { CoachAssignablePlan } from '$lib/domain/coach';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	type Props = {
		open: boolean;
		clientLabel: string;
		loading?: boolean;
		busy?: boolean;
		plans: CoachAssignablePlan[];
		onPick: (plan: CoachAssignablePlan) => void;
		onDismiss: () => void;
	};

	let { open, clientLabel, loading = false, busy = false, plans, onPick, onDismiss }: Props =
		$props();

	let lang = $derived($resolvedLocale);
</script>

<BottomSheet {open} titleId="coach-assign-title" {onDismiss} dismissible={!busy}>
	<p id="coach-assign-title" class="bottom-sheet__title">
		{translate(lang, 'coach.assignTitle')}
	</p>
	<p class="bottom-sheet__hint">
		{clientLabel} · {translate(lang, 'coach.assignHint')}
	</p>

	{#if loading}
		<div class="coach-assign-list" aria-busy="true" aria-live="polite">
			<span class="sr-only">{translate(lang, 'common.loading')}</span>
			{#each [0, 1, 2] as row (row)}
				<div class="coach-assign-skeleton" aria-hidden="true"></div>
			{/each}
		</div>
	{:else if plans.length === 0}
		<p class="bottom-sheet__hint">{translate(lang, 'coach.assignEmpty')}</p>
	{:else}
		<ul class="coach-assign-list">
			{#each plans as plan (plan.planId)}
				<li>
					<button
						type="button"
						class="coach-assign-row"
						disabled={busy}
						onclick={() => onPick(plan)}
					>
						<span class="coach-assign-row__name">{plan.name}</span>
						<span class="coach-assign-row__meta">
							{translate(lang, 'coach.assignExercises', { n: plan.exerciseCount })}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#snippet actions()}
		<AppButton variant="secondary" onclick={onDismiss} disabled={busy}>
			{translate(lang, 'common.cancel')}
		</AppButton>
	{/snippet}
</BottomSheet>
