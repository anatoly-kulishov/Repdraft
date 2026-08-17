<script lang="ts">
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelTarget } from '$lib/domain/labels.ru';
	import { translate } from '$lib/i18n/messages';
	import { draft } from '$lib/stores/draft';
	import { bookmarks } from '$lib/stores/bookmarks';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { Bookmark, Check, ChevronRight, Plus } from '@lucide/svelte';

	let {
		exercise,
		recordChips = [],
		priority = false,
		variant = 'grid',
		detailFrom = null as string | null
	}: {
		exercise: ExerciseIndexItem;
		recordChips?: string[];
		/** First-screen images: eager + high fetch priority. */
		priority?: boolean;
		variant?: 'grid' | 'list';
		/** Catalog return path for exercise detail back link. */
		detailFrom?: string | null;
	} = $props();

	let lang = $derived($resolvedLocale);
	let title = $derived(exerciseName(exercise, lang));
	let inDraft = $derived($draft.exercises.some((ex) => ex.exerciseId === exercise.id));
	let bookmarked = $derived($bookmarks.includes(exercise.id));
	let recordTitle = $derived(recordChips.length ? recordChips.join(' · ') : '');
	let loaded = $state(false);
	let bookmarkBusy = $state(false);
	let imgEl = $state<HTMLImageElement | null>(null);
	let justAdded = $state(false);

	$effect(() => {
		const img = imgEl;
		if (img?.complete && img.naturalWidth > 0) loaded = true;
	});

	function onImgLoad() {
		loaded = true;
	}

	function exerciseHref(id: string): string {
		const base = `/exercise/${id}`;
		if (!detailFrom) return base;
		return `${base}?from=${encodeURIComponent(detailFrom)}`;
	}

	function toggleDraft(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (inDraft) {
			draft.removeFromDraft(exercise.id);
			justAdded = false;
			toasts.show(translate(lang, 'exercise.removed'), 'info');
			return;
		}
		const result = draft.addToDraft(exercise.id, {
			name: exercise.name,
			equipment: exercise.equipment
		});
		if (result.added) {
			justAdded = true;
			toasts.show(translate(lang, 'exercise.added'), 'success');
		} else {
			toasts.show(translate(lang, 'exercise.already'), 'info');
		}
	}

	function toggleBookmark(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (bookmarkBusy) return;
		bookmarkBusy = true;
		void bookmarks
			.toggle(exercise.id)
			.then((saved) => {
				toasts.show(translate(lang, saved ? 'bookmarks.saved' : 'bookmarks.removed'), 'info');
			})
			.finally(() => {
				bookmarkBusy = false;
			});
	}
</script>

{#snippet listActions()}
	<div class="exercise-card-actions exercise-card-actions--list">
		<button
			type="button"
			class="exercise-card-bookmark exercise-card-bookmark--inline"
			class:is-active={bookmarked}
			onclick={toggleBookmark}
			disabled={bookmarkBusy}
			aria-busy={bookmarkBusy}
			aria-label={translate(lang, bookmarked ? 'bookmarks.remove' : 'bookmarks.add')}
			aria-pressed={bookmarked}
		>
			{#if bookmarkBusy}
				<Spinner size="sm" block={false} />
			{:else}
				<LucideIcon
					icon={Bookmark}
					size={ICON_SMALL}
					class="exercise-card-bookmark-icon"
					fill={bookmarked ? 'currentColor' : 'none'}
				/>
			{/if}
		</button>
		<button
			type="button"
			class="exercise-card-add exercise-card-add--inline"
			class:is-in-draft={inDraft}
			class:is-just-added={justAdded}
			onclick={toggleDraft}
			aria-label={translate(lang, inDraft ? 'exercise.removeDraft' : 'exercise.addDraft')}
			aria-pressed={inDraft}
		>
			{#if inDraft}
				<LucideIcon icon={Check} size={ICON_SMALL} class="exercise-card-add-icon" />
			{:else}
				<LucideIcon icon={Plus} size={ICON_SMALL} class="exercise-card-add-icon" />
			{/if}
		</button>
		<a
			href={exerciseHref(exercise.id)}
			class="exercise-card-chevron"
			tabindex="-1"
			aria-hidden="true"
		>
			<LucideIcon icon={ChevronRight} size={ICON_SMALL + 2} />
		</a>
	</div>
{/snippet}

<article
	class="exercise-card relative flex min-w-0 max-w-full flex-col overflow-hidden bg-[var(--color-surface)]"
	class:exercise-card--list={variant === 'list'}
	class:rounded-[var(--radius-panel)]={variant !== 'list'}
	class:border={variant !== 'list'}
	class:border-[var(--color-border)]={variant !== 'list'}
>
	{#if variant === 'list'}
		<a
			href={exerciseHref(exercise.id)}
			class="exercise-card-list-main"
			aria-label={title}
		>
			<div
				class="exercise-card-media media-well relative shrink-0 overflow-hidden"
			>
				<img
					bind:this={imgEl}
					src={`/${exercise.image}`}
					alt=""
					width="120"
					height="120"
					sizes="120px"
					loading={priority ? 'eager' : 'lazy'}
					fetchpriority={priority ? 'high' : 'auto'}
					decoding="async"
					class={`exercise-card-img block h-full w-full object-contain ${loaded ? 'is-loaded' : ''}`}
					onload={onImgLoad}
				/>
			</div>
			<span class="exercise-card-body flex min-w-0 flex-col gap-0.5">
				<span class="exercise-card-list-title line-clamp-2 font-semibold leading-snug text-[var(--color-ink)]">
					{title}
				</span>
				{#if recordChips.length > 0}
					<span
						class="exercise-card-list-meta-stack"
						title={`${labelTarget(exercise.target, lang)} · ${recordTitle}`}
					>
						<span class="exercise-card-list-target">{labelTarget(exercise.target, lang)}</span>
						<span class="exercise-card-list-records" aria-label={recordTitle}>
							{#each recordChips as chip, i (chip)}
								<span
									class="exercise-card-list-record"
									class:is-note={i > 0}
								>
									{chip}
								</span>
							{/each}
						</span>
					</span>
				{:else}
					<span class="exercise-card-list-subline" title={labelTarget(exercise.target, lang)}>
						<span class="exercise-card-list-target">{labelTarget(exercise.target, lang)}</span>
					</span>
				{/if}
			</span>
		</a>
		{@render listActions()}
	{:else}
		<div
			class="exercise-card-media exercise-card-media--grid media-well relative aspect-square min-w-0 overflow-hidden"
		>
			<a
				href={exerciseHref(exercise.id)}
				class="exercise-card-media-link absolute inset-0 flex items-center justify-center active:bg-[var(--color-surface-muted)]"
				aria-label={title}
			>
				<img
					bind:this={imgEl}
					src={`/${exercise.image}`}
					alt=""
					width="180"
					height="180"
					sizes="(min-width: 1024px) 16vw, (min-width: 768px) 22vw, 45vw"
					loading={priority ? 'eager' : 'lazy'}
					fetchpriority={priority ? 'high' : 'auto'}
					decoding="async"
					class={`exercise-card-img block h-full w-full object-contain ${loaded ? 'is-loaded' : ''}`}
					onload={onImgLoad}
				/>
			</a>
			<button
				type="button"
				class="exercise-card-bookmark"
				class:is-active={bookmarked}
				onclick={toggleBookmark}
				disabled={bookmarkBusy}
				aria-busy={bookmarkBusy}
				aria-label={translate(lang, bookmarked ? 'bookmarks.remove' : 'bookmarks.add')}
				aria-pressed={bookmarked}
			>
				{#if bookmarkBusy}
					<Spinner size="sm" block={false} />
				{:else}
					<LucideIcon
						icon={Bookmark}
						size={ICON_SMALL}
						class="exercise-card-bookmark-icon"
						fill={bookmarked ? 'currentColor' : 'none'}
					/>
				{/if}
			</button>
			<button
				type="button"
				class="exercise-card-add"
				class:is-in-draft={inDraft}
				class:is-just-added={justAdded}
				onclick={toggleDraft}
				aria-label={translate(lang, inDraft ? 'exercise.removeDraft' : 'exercise.addDraft')}
				aria-pressed={inDraft}
			>
				{#if inDraft}
					<LucideIcon icon={Check} size={ICON_SMALL} class="exercise-card-add-icon" />
				{:else}
					<LucideIcon icon={Plus} size={ICON_SMALL} class="exercise-card-add-icon" />
				{/if}
			</button>
		</div>

		<a
			href={exerciseHref(exercise.id)}
			class="exercise-card-body flex min-w-0 flex-1 flex-col gap-0.5 p-2.5 active:bg-[var(--color-surface-muted)]"
		>
			<h2 class="line-clamp-2 min-h-[2.1em] text-[13px] font-semibold leading-snug text-[var(--color-ink)]">
				{title}
			</h2>
			<p class="truncate text-[11px] text-[var(--color-muted)]">
				{labelTarget(exercise.target, lang)}
			</p>
			{#if recordChips.length > 0}
				<span class="exercise-card-chip-row exercise-card-chip-row--grid" title={recordTitle}>
					{#each recordChips as chip (chip)}
						<span class="exercise-card-record-chip">{chip}</span>
					{/each}
				</span>
			{/if}
		</a>
	{/if}
</article>
