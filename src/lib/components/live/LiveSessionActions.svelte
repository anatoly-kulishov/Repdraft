<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_BUTTON, ICON_PRIMARY } from '$lib/components/icons/sizes';
	import { CircleCheck, ChevronDown, ChevronRight, ChevronUp, Minus, Plus, SkipForward } from '@lucide/svelte';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';

	let {
		lang,
		finishing,
		hasNextExercise,
		currentExerciseComplete = false,
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
		/** Another exercise exists after the current one. */
		hasNextExercise: boolean;
		/** All sets on the current exercise are logged — Next becomes primary. */
		currentExerciseComplete?: boolean;
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
	let restExpanded = $state(false);
	/** Primary CTA = Next only after this exercise is done; else Finish on last exercise. */
	let nextIsPrimary = $derived(hasNextExercise && currentExerciseComplete);
	let showFinish = $derived(!hasNextExercise);
	let pairLayout = $derived(layout === 'mobile');
	let restCompact = $derived(pairLayout && !restExpanded);

	$effect(() => {
		if (restLeft <= 0) restExpanded = false;
	});
</script>

{#snippet finishPrimary()}
	<AppButton
		block={pairLayout}
		class="{pairLayout
			? 'live-session-pair__btn'
			: 'inline-flex'} items-center justify-center gap-2"
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
	</AppButton>
{/snippet}

{#snippet nextButton(primary: boolean)}
	<AppButton
		variant={primary ? 'primary' : 'secondary'}
		block={pairLayout}
		class="{pairLayout
			? 'live-session-pair__btn'
			: 'inline-flex'} items-center justify-center gap-2 {primary
			? 'live-session-next--ready'
			: 'live-session-next--soft'}"
		disabled={finishing}
		aria-label={translate(lang, 'live.nextExercise')}
		onclick={onNext}
	>
		{translate(lang, pairLayout ? 'live.nextShort' : 'live.nextExercise')}
		<LucideIcon icon={ChevronRight} size={ICON_PRIMARY} />
	</AppButton>
{/snippet}

{#snippet discardAction()}
	{#if pairLayout}
		<AppButton
			variant="danger"
			block
			class="live-session-pair__btn live-session-discard-btn"
			disabled={finishing}
			onclick={onDiscard}
		>
			{translate(lang, 'live.discard')}
		</AppButton>
	{:else}
		<AppButton variant="link" class="live-session-discard" disabled={finishing} onclick={onDiscard}>
			{translate(lang, 'live.discard')}
		</AppButton>
	{/if}
{/snippet}

{#snippet actionPair()}
	{#if nextIsPrimary}
		{@render discardAction()}
		{@render nextButton(true)}
	{:else if hasNextExercise}
		{@render discardAction()}
		{@render nextButton(false)}
	{:else}
		{@render discardAction()}
		{@render finishPrimary()}
	{/if}
{/snippet}

{#snippet restStrip()}
	<div
		class="live-rest live-rest--sticky"
		class:live-rest--compact={restCompact}
		role="timer"
		aria-live="polite"
		aria-atomic="true"
		aria-label={`${translate(lang, 'live.rest')}: ${restLabel}`}
	>
		<AppButton
			variant="ghost"
			class="live-rest__chip"
			aria-label={translate(lang, 'live.restMinus30Aria')}
			title={translate(lang, 'live.restMinus30Aria')}
			onclick={() => onRestMinus?.()}
		>
			<LucideIcon icon={Minus} size={ICON_BUTTON} />
		</AppButton>
		<div class="live-rest__mid">
			{#key restLeft}
				<p class="live-rest-value">{restLabel}</p>
			{/key}
			<div class="live-rest__bar" style={`--rest-pct: ${restPct}`} aria-hidden="true"></div>
		</div>
		<AppButton
			variant="ghost"
			class="live-rest__chip"
			aria-label={translate(lang, 'live.restPlus30Aria')}
			title={translate(lang, 'live.restPlus30Aria')}
			onclick={() => onRestPlus?.()}
		>
			<LucideIcon icon={Plus} size={ICON_BUTTON} />
		</AppButton>
		<AppButton
			variant="ghost"
			class="live-rest__skip"
			aria-label={translate(lang, 'live.skipRest')}
			title={translate(lang, 'live.skipRest')}
			onclick={() => onRestSkip?.()}
		>
			<LucideIcon icon={SkipForward} size={ICON_BUTTON} />
		</AppButton>
		{#if pairLayout}
			<AppButton
				variant="ghost"
				class="live-rest__expand"
				aria-label={restExpanded
					? translate(lang, 'live.restCollapseAria')
					: translate(lang, 'live.restExpandAria')}
				title={restExpanded
					? translate(lang, 'live.restCollapseAria')
					: translate(lang, 'live.restExpandAria')}
				aria-expanded={restExpanded}
				onclick={() => {
					restExpanded = !restExpanded;
				}}
			>
				<LucideIcon icon={restExpanded ? ChevronDown : ChevronUp} size={ICON_BUTTON} />
			</AppButton>
		{/if}
	</div>
{/snippet}

{#if layout === 'desktop'}
	<footer class="live-desktop-actions">
		{#if showRest}
			{@render restStrip()}
		{/if}
		{@render actionPair()}
	</footer>
{:else}
	<div
		class="live-sticky-actions sticky-actions"
		class:live-sticky-actions--end={showFinish}
		class:live-sticky-actions--rest={showRest}
		class:live-sticky-actions--rest-compact={showRest && restCompact}
		class:live-sticky-actions--rest-expanded={showRest && restExpanded}
	>
		{#if showRest}
			{@render restStrip()}
		{/if}
		<div class="sticky-actions__inner live-session-pair">
			{@render actionPair()}
		</div>
	</div>
{/if}
