<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_PRIMARY } from '$lib/components/icons/sizes';
	import { CircleCheck, ChevronRight } from '@lucide/svelte';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';

	let {
		lang,
		finishing,
		canGoNext,
		onNext,
		onFinish,
		onDiscard,
		layout = 'desktop',
		restLeft = 0,
		restPct = 0,
		restLabel = '',
		onRestMinus = undefined,
		onRestPlus = undefined,
		onRestSkip = undefined
	}: {
		lang: AppLocale;
		finishing: boolean;
		canGoNext: boolean;
		onNext: () => void;
		onFinish: () => void;
		onDiscard: () => void;
		layout?: 'desktop' | 'mobile';
		/** Seconds left; >0 shows rest strip inside the sticky chrome. */
		restLeft?: number;
		restPct?: number;
		restLabel?: string;
		onRestMinus?: () => void;
		onRestPlus?: () => void;
		onRestSkip?: () => void;
	} = $props();

	let showRest = $derived(restLeft > 0 && Boolean(onRestMinus && onRestPlus && onRestSkip));
</script>

{#snippet finishPrimary()}
	<button
		type="button"
		class="btn-primary {layout === 'mobile'
			? 'btn-block min-h-12'
			: 'inline-flex min-h-11'} items-center justify-center gap-2"
		disabled={finishing}
		aria-busy={finishing}
		onclick={onFinish}
	>
		{#if finishing}
			<Spinner size="sm" block={false} />
			{translate(lang, 'auth.wait')}
		{:else}
			<LucideIcon icon={CircleCheck} size={ICON_PRIMARY} />
			{translate(lang, 'live.finish')}
		{/if}
	</button>
{/snippet}

{#snippet discardLink()}
	<button
		type="button"
		class="btn-link live-session-discard"
		disabled={finishing}
		onclick={onDiscard}
	>
		{translate(lang, 'live.discard')}
	</button>
{/snippet}

{#snippet restStrip()}
	<div
		class="live-rest live-rest--sticky"
		role="timer"
		aria-live="polite"
		aria-atomic="true"
		aria-label={`${translate(lang, 'live.rest')}: ${restLabel}`}
	>
		<button
			type="button"
			class="btn-ghost live-rest__chip"
			aria-label={translate(lang, 'live.restMinus30Aria')}
			onclick={() => onRestMinus?.()}
		>
			{translate(lang, 'live.restMinus30')}
		</button>
		<div class="live-rest__mid">
			{#key restLeft}
				<p class="live-rest-value">{restLabel}</p>
			{/key}
			<div class="live-rest__bar" style={`--rest-pct: ${restPct}`} aria-hidden="true"></div>
		</div>
		<button
			type="button"
			class="btn-ghost live-rest__chip"
			aria-label={translate(lang, 'live.restPlus30Aria')}
			onclick={() => onRestPlus?.()}
		>
			{translate(lang, 'live.restPlus30')}
		</button>
		<button type="button" class="btn-secondary live-rest__skip" onclick={() => onRestSkip?.()}>
			{translate(lang, 'live.skipRest')}
		</button>
	</div>
{/snippet}

{#if layout === 'desktop'}
	<footer class="live-desktop-actions">
		{#if showRest}
			{@render restStrip()}
		{/if}
		{#if canGoNext}
			<button
				type="button"
				class="btn-primary inline-flex min-h-11 items-center gap-2"
				disabled={finishing}
				onclick={onNext}
			>
				{translate(lang, 'live.nextExercise')}
				<LucideIcon icon={ChevronRight} size={ICON_PRIMARY} />
			</button>
			{@render discardLink()}
		{:else}
			{@render finishPrimary()}
			{@render discardLink()}
		{/if}
	</footer>
{:else}
	<div
		class="live-sticky-actions sticky-actions lg:hidden"
		class:live-sticky-actions--end={!canGoNext}
		class:live-sticky-actions--rest={showRest}
	>
		{#if showRest}
			{@render restStrip()}
		{/if}
		<div class="sticky-actions__inner">
			{#if canGoNext}
				<button
					type="button"
					class="btn-primary btn-block min-h-12 gap-2"
					disabled={finishing}
					onclick={onNext}
				>
					{translate(lang, 'live.nextExercise')}
					<LucideIcon icon={ChevronRight} size={ICON_PRIMARY} />
				</button>
				{@render discardLink()}
			{:else}
				{@render finishPrimary()}
				{@render discardLink()}
			{/if}
		</div>
	</div>
{/if}
