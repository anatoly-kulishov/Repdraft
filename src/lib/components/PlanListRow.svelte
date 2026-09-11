<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import ExerciseReorderHandle from '$lib/components/ExerciseReorderHandle.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SwipeToDelete, { type SwipeRowAction } from '$lib/components/SwipeToDelete.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import type { ExerciseIndexItem, WorkoutPlan } from '$lib/domain/types';
	import { planTargetSummary } from '$lib/domain/planTargets';
	import { planExerciseSlotCount } from '$lib/domain/workout';
	import { translate } from '$lib/i18n/messages';
	import { cn } from '$lib/utils.js';
	import { Copy, Flag, Play, Trash2 } from '@lucide/svelte';
	import type { AppLocale } from '$lib/i18n/locale';

	let {
		plan,
		index,
		lang,
		indexById,
		isNext,
		canReorder,
		reorderFrom,
		reorderOver,
		busyId,
		busyOp,
		leadingActions,
		trailingActions,
		onOpen,
		onPin,
		onDuplicate,
		onRemove,
		onPreview,
		onReorder
	}: {
		plan: WorkoutPlan;
		index: number;
		lang: AppLocale;
		indexById: Map<string, ExerciseIndexItem>;
		isNext: boolean;
		canReorder: boolean;
		reorderFrom: number | null;
		reorderOver: number | null;
		busyId: string | null;
		busyOp: 'copy' | 'delete' | null;
		leadingActions: SwipeRowAction[];
		trailingActions: SwipeRowAction[];
		onOpen: (plan: WorkoutPlan) => void;
		onPin: (planId: string, planName: string) => void;
		onDuplicate: (planId: string) => void;
		onRemove: (planId: string, planName: string) => void;
		onPreview: (plan: WorkoutPlan) => void;
		onReorder: (from: number, to: number) => void;
	} = $props();

	let muscles = $derived(planTargetSummary(plan, indexById, lang));
	let rowBusy = $derived(busyId !== null);
</script>

<li
	class="plan-list-item"
	class:plan-list-item--reorder-dragging={reorderFrom === index}
	class:plan-list-item--reorder-over={reorderOver === index}
	data-plan-index={index}
>
	<SwipeToDelete
		disabled={rowBusy || reorderFrom !== null}
		{leadingActions}
		actions={trailingActions}
	>
		<div class="entity-row">
			<a class="entity-row__main" href={`/workouts/${plan.id}`} onclick={() => onPreview(plan)}>
				<span class="entity-row__title">{plan.name}</span>
				{#if muscles}
					<span class="entity-row__meta">{muscles}</span>
				{:else}
					<span class="entity-row__meta" aria-hidden="true">&nbsp;</span>
				{/if}
				<span class="entity-row__meta-row">
					<span class="entity-row__meta">
						{translate(lang, 'workouts.exCount', {
							n: planExerciseSlotCount(plan)
						})}
					</span>
					{#if isNext}
						<span class="entity-row__badge">{translate(lang, 'home.nextPlanBadge')}</span>
					{/if}
				</span>
			</a>
			<div class="entity-row__actions">
				<AppButton
					variant="ghost"
					class={cn('entity-row__pin entity-row__pin--desktop', isNext && 'is-pinned')}
					onclick={() => onPin(plan.id, plan.name)}
					disabled={rowBusy || isNext}
					aria-label={translate(lang, 'home.setNextPlan')}
					title={translate(lang, isNext ? 'home.nextPlanBadge' : 'home.setNextPlan')}
				>
					<LucideIcon icon={Flag} size={ICON_SMALL} />
				</AppButton>
				<AppButton
					variant="ghost"
					class="entity-row__start entity-row__start--desktop"
					onclick={() => onOpen(plan)}
					disabled={plan.exercises.length === 0 || rowBusy}
					aria-label={translate(lang, 'workouts.open')}
					title={translate(lang, 'workouts.open')}
				>
					<LucideIcon icon={Play} size={ICON_SMALL} />
				</AppButton>
				<AppButton
					variant="ghost"
					aria-label={translate(lang, 'workouts.duplicate')}
					title={translate(lang, 'workouts.duplicate')}
					disabled={rowBusy}
					aria-busy={busyId === plan.id && busyOp === 'copy'}
					onclick={() => onDuplicate(plan.id)}
				>
					{#if busyId === plan.id && busyOp === 'copy'}
						<Spinner size="sm" block={false} />
					{:else}
						<LucideIcon icon={Copy} size={ICON_SMALL} />
					{/if}
				</AppButton>
				<AppButton
					variant="ghost"
					class="is-danger"
					aria-label={translate(lang, 'workouts.delete')}
					title={translate(lang, 'workouts.delete')}
					disabled={rowBusy}
					aria-busy={busyId === plan.id && busyOp === 'delete'}
					onclick={() => onRemove(plan.id, plan.name)}
				>
					{#if busyId === plan.id && busyOp === 'delete'}
						<Spinner size="sm" block={false} />
					{:else}
						<LucideIcon icon={Trash2} size={ICON_SMALL} />
					{/if}
				</AppButton>
			</div>
			{#if canReorder && !isNext}
				<ExerciseReorderHandle
					{index}
					holdMs={0}
					label={translate(lang, 'builder.reorder')}
					onreorder={onReorder}
					targetSelector="[data-plan-index]"
					indexAttribute="data-plan-index"
					rootActiveClass="is-plan-reorder-active"
					eventName="repdraft:plan-reorder"
				/>
			{/if}
		</div>
	</SwipeToDelete>
</li>
