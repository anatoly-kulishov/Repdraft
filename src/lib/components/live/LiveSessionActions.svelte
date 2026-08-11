<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_BUTTON, ICON_PRIMARY } from '$lib/components/icons/sizes';
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
			<button
				type="button"
				class="btn-secondary inline-flex min-h-11 items-center gap-2"
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
		{:else}
			<button
				type="button"
				class="btn-primary inline-flex min-h-11 items-center gap-2"
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
		{/if}
		<button type="button" class="btn-ghost is-danger" disabled={finishing} onclick={onDiscard}>
			{translate(lang, 'live.discard')}
		</button>
	</footer>
{:else}
	<div class="live-sticky-actions sticky-actions lg:hidden">
		<div class="sticky-actions__inner">
			{#if canGoNext}
				<button type="button" class="btn-primary btn-block min-h-12 gap-2" disabled={finishing} onclick={onNext}>
					{translate(lang, 'live.nextExercise')}
					<LucideIcon icon={ChevronRight} size={ICON_PRIMARY} />
				</button>
				<button
					type="button"
					class="btn-secondary btn-block min-h-11 gap-2"
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
			{:else}
				<button
					type="button"
					class="btn-primary btn-block min-h-12 gap-2"
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
			{/if}
			<button
				type="button"
				class="btn-link mx-auto !text-[var(--color-muted)]"
				disabled={finishing}
				onclick={onDiscard}
			>
				{translate(lang, 'live.discard')}
			</button>
		</div>
	</div>
{/if}
