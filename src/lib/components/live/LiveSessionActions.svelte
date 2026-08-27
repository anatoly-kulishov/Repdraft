<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_BUTTON, ICON_PRIMARY } from '$lib/components/icons/sizes';
	import { CircleCheck, ChevronRight, Minus, Plus, SkipForward } from '@lucide/svelte';
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
	/** Primary CTA = Next only after this exercise is done; else Finish on last exercise. */
	let nextIsPrimary = $derived(hasNextExercise && currentExerciseComplete);
	let showFinish = $derived(!hasNextExercise);
</script>

{#snippet finishPrimary()}
	<AppButton
		block={layout === 'mobile'}
		class="{layout === 'mobile' ? '' : 'inline-flex'} items-center justify-center gap-2"
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
	{@const nextLocked = !currentExerciseComplete}
	<AppButton
		variant={primary ? 'primary' : 'secondary'}
		block={layout === 'mobile'}
		class="{layout === 'mobile' ? '' : 'inline-flex'} items-center justify-center gap-2 {primary
			? ''
			: 'live-session-next--demoted'}{nextLocked ? ' live-session-next--locked' : ''}"
		disabled={finishing || nextLocked}
		aria-disabled={finishing || nextLocked}
		aria-label={nextLocked
			? translate(lang, 'live.nextLockedAria')
			: translate(lang, 'live.nextExercise')}
		title={nextLocked ? translate(lang, 'live.nextLockedHint') : undefined}
		onclick={onNext}
	>
		{translate(lang, 'live.nextExercise')}
		<LucideIcon icon={ChevronRight} size={ICON_PRIMARY} />
	</AppButton>
{/snippet}

{#snippet discardLink()}
	<AppButton variant="link" class="live-session-discard" disabled={finishing} onclick={onDiscard}>
		{translate(lang, 'live.discard')}
	</AppButton>
{/snippet}

{#snippet restStrip()}
	<div
		class="live-rest live-rest--sticky"
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
	</div>
{/snippet}

{#if layout === 'desktop'}
	<footer class="live-desktop-actions">
		{#if showRest}
			{@render restStrip()}
		{/if}
		{#if nextIsPrimary}
			{@render nextButton(true)}
			{@render discardLink()}
		{:else if hasNextExercise}
			{@render nextButton(false)}
			{@render discardLink()}
		{:else}
			{@render finishPrimary()}
			{@render discardLink()}
		{/if}
	</footer>
{:else}
	<div
		class="live-sticky-actions sticky-actions"
		class:live-sticky-actions--end={showFinish}
		class:live-sticky-actions--rest={showRest}
	>
		{#if showRest}
			{@render restStrip()}
		{/if}
		<div class="sticky-actions__inner">
			{#if nextIsPrimary}
				{@render nextButton(true)}
				{@render discardLink()}
			{:else if hasNextExercise}
				{@render nextButton(false)}
				{@render discardLink()}
			{:else}
				{@render finishPrimary()}
				{@render discardLink()}
			{/if}
		</div>
	</div>
{/if}
