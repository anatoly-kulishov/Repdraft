<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import {
		dayKeyRangeRole,
		monthCalendarCells,
		normalizeDayRange,
		parseDayKey,
		shiftMonth
	} from '$lib/domain/calendar';
	import { toLocalDayKey } from '$lib/i18n/format';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';

	let {
		open = false,
		from = '',
		to = '',
		maxDayKey = toLocalDayKey(),
		onSelect,
		onClear,
		onDismiss
	}: {
		open?: boolean;
		from?: string;
		to?: string;
		maxDayKey?: string;
		onSelect: (from: string, to: string) => void;
		onClear: () => void;
		onDismiss: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let localeTag = $derived(lang === 'ru' ? 'ru-RU' : 'en-US');
	let weekStartsOn = $derived(lang === 'ru' ? (1 as const) : (0 as const));
	let titleId = 'history-day-picker-title';
	let todayKey = $derived(toLocalDayKey());

	let cursor = $state({ year: 0, monthIndex: 0 });
	let draftFrom = $state('');
	let draftTo = $state('');

	$effect(() => {
		if (!open) return;
		draftFrom = from;
		draftTo = to;
		const anchor = parseDayKey(from) ?? parseDayKey(to) ?? parseDayKey(maxDayKey);
		const now = new Date();
		cursor = anchor
			? { year: anchor.year, monthIndex: anchor.monthIndex }
			: { year: now.getFullYear(), monthIndex: now.getMonth() };
	});

	let monthLabel = $derived(
		new Intl.DateTimeFormat(localeTag, { month: 'long', year: 'numeric' }).format(
			new Date(cursor.year, cursor.monthIndex, 1)
		)
	);
	let weekdayLabels = $derived.by(() => {
		const fmt = new Intl.DateTimeFormat(localeTag, { weekday: 'short' });
		return Array.from({ length: 7 }, (_, i) => {
			const day = (i + weekStartsOn) % 7;
			return fmt.format(new Date(2021, 7, day + 1)).replace(/\.$/, '');
		});
	});
	let cells = $derived(
		monthCalendarCells(cursor.year, cursor.monthIndex, { weekStartsOn, maxDayKey })
	);
	let canGoNext = $derived.by(() => {
		const next = shiftMonth(cursor.year, cursor.monthIndex, 1);
		const first = `${next.year}-${String(next.monthIndex + 1).padStart(2, '0')}-01`;
		return first <= maxDayKey;
	});

	function goMonth(delta: number) {
		if (delta > 0 && !canGoNext) return;
		cursor = shiftMonth(cursor.year, cursor.monthIndex, delta);
	}

	function pick(dayKey: string, disabled: boolean) {
		if (disabled) return;
		if (!draftFrom || draftTo) {
			draftFrom = dayKey;
			draftTo = '';
			return;
		}
		const range = normalizeDayRange(draftFrom, dayKey);
		draftFrom = range.from;
		draftTo = range.to;
		onSelect(range.from, range.to);
		onDismiss();
	}

	function pickToday() {
		const day = maxDayKey;
		draftFrom = day;
		draftTo = day;
		onSelect(day, day);
		onDismiss();
	}

	function clearAndClose() {
		draftFrom = '';
		draftTo = '';
		onClear();
		onDismiss();
	}
</script>

{#snippet actions()}
	<AppButton variant="secondary" onclick={clearAndClose}>
		{translate(lang, 'catalog.reset')}
	</AppButton>
	<AppButton onclick={pickToday}>
		{translate(lang, 'home.today')}
	</AppButton>
{/snippet}

{#if open}
	<BottomSheet {open} raised {titleId} {onDismiss} {actions}>
		<div class="bottom-sheet__head">
			<p id={titleId} class="bottom-sheet__title">{translate(lang, 'workouts.historyPickRange')}</p>
			<p class="bottom-sheet__hint">{translate(lang, 'workouts.historyPickRangeHint')}</p>
		</div>
		<div class="history-day-cal">
			<div class="history-day-cal__nav">
				<AppButton
					variant="ghost"
					class="history-day-cal__nav-btn"
					aria-label={translate(lang, 'workouts.historyPrevMonth')}
					onclick={() => goMonth(-1)}
				>
					<LucideIcon icon={ChevronLeft} size={ICON_SMALL} />
				</AppButton>
				<p class="history-day-cal__month">{monthLabel}</p>
				<AppButton
					variant="ghost"
					class="history-day-cal__nav-btn"
					aria-label={translate(lang, 'workouts.historyNextMonth')}
					disabled={!canGoNext}
					onclick={() => goMonth(1)}
				>
					<LucideIcon icon={ChevronRight} size={ICON_SMALL} />
				</AppButton>
			</div>
			<div class="history-day-cal__weekdays" aria-hidden="true">
				{#each weekdayLabels as label, i (`${i}-${label}`)}
					<span>{label}</span>
				{/each}
			</div>
			<div class="history-day-cal__grid" role="grid" aria-label={monthLabel}>
				{#each cells as cell (cell.dayKey)}
					{@const role = dayKeyRangeRole(cell.dayKey, draftFrom, draftTo)}
					<button
						type="button"
						class="history-day-cal__cell"
						class:is-muted={!cell.inMonth}
						class:is-range-start={role === 'start'}
						class:is-range-end={role === 'end'}
						class:is-range-single={role === 'single'}
						class:is-in-range={role === 'in-range'}
						class:is-today={cell.dayKey === todayKey && role === 'none'}
						disabled={cell.disabled}
						onclick={() => pick(cell.dayKey, cell.disabled)}
					>
						{Number(cell.dayKey.slice(8))}
					</button>
				{/each}
			</div>
		</div>
	</BottomSheet>
{/if}
