<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppChip from '$lib/components/AppChip.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { labelTarget } from '$lib/domain/labels.ru';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Check } from '@lucide/svelte';

	let {
		open = false,
		selected = '',
		targets = [],
		onSelect,
		onClear,
		onDismiss
	}: {
		open?: boolean;
		/** Empty = all muscles. */
		selected?: string;
		targets?: readonly string[];
		onSelect: (target: string) => void;
		onClear: () => void;
		onDismiss: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let titleId = 'plans-muscle-filter-sheet-title';
	let hasActive = $derived(selected !== '');

	function clearAndClose() {
		onClear();
		onDismiss();
	}

	function pickTarget(target: string) {
		onSelect(target);
		onDismiss();
	}
</script>

{#snippet actions()}
	<AppButton variant="danger" onclick={clearAndClose}>
		{translate(lang, 'workouts.historyClearFiltersAria')}
	</AppButton>
{/snippet}

{#if open}
	<BottomSheet {open} raised {titleId} {onDismiss} actions={hasActive ? actions : null}>
		<div class="bottom-sheet__head">
			<p id={titleId} class="bottom-sheet__title">
				{translate(lang, 'workouts.muscleFilter')}
			</p>
		</div>
		<div class="catalog-equipment-sheet-options" role="radiogroup" aria-labelledby={titleId}>
			<AppChip
				class="catalog-equipment-sheet-option !h-auto !min-h-12 !w-full !rounded-[var(--radius-control)] !px-[0.85rem] !py-[0.55rem]"
				active={!hasActive}
				role="radio"
				aria-checked={!hasActive}
				onclick={clearAndClose}
			>
				<span class="catalog-equipment-sheet-option__label">
					{translate(lang, 'workouts.historyFilterAll')}
				</span>
				{#if !hasActive}
					<span class="catalog-equipment-sheet-option__check" aria-hidden="true">
						<LucideIcon icon={Check} size={ICON_SMALL} />
					</span>
				{/if}
			</AppChip>
			{#each targets as target (target)}
				<AppChip
					class="catalog-equipment-sheet-option !h-auto !min-h-12 !w-full !rounded-[var(--radius-control)] !px-[0.85rem] !py-[0.55rem]"
					active={selected === target}
					role="radio"
					aria-checked={selected === target}
					onclick={() => pickTarget(target)}
				>
					<span class="catalog-equipment-sheet-option__label">{labelTarget(target, lang)}</span>
					{#if selected === target}
						<span class="catalog-equipment-sheet-option__check" aria-hidden="true">
							<LucideIcon icon={Check} size={ICON_SMALL} />
						</span>
					{/if}
				</AppChip>
			{/each}
		</div>
	</BottomSheet>
{/if}
