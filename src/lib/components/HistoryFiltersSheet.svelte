<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppChip from '$lib/components/AppChip.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Calendar } from '@lucide/svelte';

	type HistoryDatePreset = 'all' | 'today';

	let {
		open = false,
		preset = 'all',
		rangeActive = false,
		rangeLabel = '',
		onSelectPreset,
		onPickRange,
		onClear,
		onDismiss
	}: {
		open?: boolean;
		preset?: HistoryDatePreset;
		/** Custom day range wins over preset — its chip is the active one. */
		rangeActive?: boolean;
		/** Formatted range ("2–5 сен") shown inside the range option. */
		rangeLabel?: string;
		onSelectPreset: (preset: HistoryDatePreset) => void;
		/** Opens the day-range picker (parent swaps sheets). */
		onPickRange: () => void;
		onClear: () => void;
		onDismiss: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let titleId = 'history-filters-sheet-title';
	let hasActive = $derived(preset !== 'all' || rangeActive);

	function pickPreset(next: HistoryDatePreset) {
		onSelectPreset(next);
		onDismiss();
	}

	function pickRange() {
		onDismiss();
		onPickRange();
	}

	function clear() {
		onClear();
		onDismiss();
	}
</script>

{#snippet actions()}
	<AppButton variant="secondary" onclick={clear}>
		{translate(lang, 'workouts.historyClearFiltersAria')}
	</AppButton>
{/snippet}

{#if open}
	<BottomSheet {open} raised {titleId} {onDismiss} actions={hasActive ? actions : null}>
		<div class="bottom-sheet__head">
			<p id={titleId} class="bottom-sheet__title">
				{translate(lang, 'workouts.historyDateFilter')}
			</p>
		</div>
		<div class="catalog-equipment-sheet-options" role="group" aria-labelledby={titleId}>
			<AppChip
				class="catalog-equipment-sheet-option !h-auto !min-h-12 w-full justify-start rounded-[var(--radius-control)] px-[0.9rem] py-[0.65rem] text-left font-medium"
				active={preset === 'all' && !rangeActive}
				onclick={() => pickPreset('all')}
			>
				{translate(lang, 'workouts.historyFilterAll')}
			</AppChip>
			<AppChip
				class="catalog-equipment-sheet-option !h-auto !min-h-12 w-full justify-start rounded-[var(--radius-control)] px-[0.9rem] py-[0.65rem] text-left font-medium"
				active={preset === 'today' && !rangeActive}
				onclick={() => pickPreset('today')}
			>
				{translate(lang, 'home.today')}
			</AppChip>
			<AppChip
				class="catalog-equipment-sheet-option !h-auto !min-h-12 w-full justify-start rounded-[var(--radius-control)] px-[0.9rem] py-[0.65rem] text-left font-medium"
				active={rangeActive}
				onclick={pickRange}
			>
				<span class="history-filters-sheet__range">
					<LucideIcon icon={Calendar} size={ICON_SMALL} />
					<span class="history-filters-sheet__range-label">
						{rangeActive ? rangeLabel : translate(lang, 'workouts.historyPickRange')}
					</span>
				</span>
			</AppChip>
		</div>
	</BottomSheet>
{/if}

<style>
	.history-filters-sheet__range {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}

	.history-filters-sheet__range-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
