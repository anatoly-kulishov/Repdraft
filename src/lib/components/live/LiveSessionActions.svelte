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
		layout = 'desktop'
	}: {
		lang: AppLocale;
		finishing: boolean;
		canGoNext: boolean;
		onNext: () => void;
		onFinish: () => void;
		onDiscard: () => void;
		layout?: 'desktop' | 'mobile';
	} = $props();
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

{#snippet secondaryRow()}
	<div class="live-session-secondary" class:live-session-secondary--pair={canGoNext}>
		<button
			type="button"
			class="btn-danger live-session-secondary__btn"
			disabled={finishing}
			onclick={onDiscard}
		>
			{translate(lang, 'live.discard')}
		</button>
		{#if canGoNext}
			<button
				type="button"
				class="btn-secondary live-session-secondary__btn"
				disabled={finishing}
				aria-busy={finishing}
				onclick={onFinish}
			>
				{#if finishing}
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.wait')}
				{:else}
					{translate(lang, 'live.finish')}
				{/if}
			</button>
		{/if}
	</div>
{/snippet}

{#if layout === 'desktop'}
	<footer class="live-desktop-actions">
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
		{:else}
			{@render finishPrimary()}
		{/if}
		{@render secondaryRow()}
	</footer>
{:else}
	<div class="live-sticky-actions sticky-actions lg:hidden">
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
			{:else}
				{@render finishPrimary()}
			{/if}
			{@render secondaryRow()}
		</div>
	</div>
{/if}
