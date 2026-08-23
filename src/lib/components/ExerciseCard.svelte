<script lang="ts">
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelTarget } from '$lib/domain/labels.ru';
	import { translate } from '$lib/i18n/messages';
	import { draft } from '$lib/stores/draft';
	import { bookmarks } from '$lib/stores/bookmarks';
	import { records } from '$lib/stores/records';
	import { techniqueClipHints } from '$lib/stores/techniqueClipHints';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppIconButton from '$lib/components/AppIconButton.svelte';
	import { cn } from '$lib/utils.js';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import CloseIconButton from '$lib/components/CloseIconButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { linkWithFrom } from '$lib/domain/navigation';
	import { Bookmark, Check, ChevronRight, Film, Plus, StickyNote } from '@lucide/svelte';

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
	let noteText = $derived(
		($records.find((r) => r.exerciseId === exercise.id)?.note ?? '').trim()
	);
	let hasNote = $derived(noteText.length > 0);
	let clipHintIds = $derived($techniqueClipHints);
	let hasClip = $derived(clipHintIds.has(exercise.id));
	let loaded = $state(false);
	let bookmarkBusy = $state(false);
	let imgEl = $state<HTMLImageElement | null>(null);
	let justAdded = $state(false);
	let techniqueOpen = $state(false);
	let techniqueSrc = $state('');

	/** Slim index has JPG only; GIF lives at the same stem under /videos. */
	function techniqueMediaSrc(imagePath: string): string {
		return `/${imagePath.replace(/^images\//, 'videos/').replace(/\.jpe?g$/i, '.gif')}`;
	}

	$effect(() => {
		const img = imgEl;
		if (img?.complete && img.naturalWidth > 0) loaded = true;
	});

	function onImgLoad() {
		loaded = true;
	}

	function exerciseHref(id: string): string {
		if (!detailFrom) return `/exercise/${id}`;
		return linkWithFrom(`/exercise/${id}`, detailFrom);
	}

	function openTechnique() {
		techniqueSrc = techniqueMediaSrc(exercise.image);
		techniqueOpen = true;
	}

	function dismissTechnique() {
		techniqueOpen = false;
	}

	function onTechniqueImgError(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		const fallback = `/${exercise.image}`;
		if (img.src.endsWith(fallback) || img.getAttribute('src') === fallback) return;
		img.src = fallback;
	}

	function toggleDraft(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (inDraft) {
			draft.removeFromDraft(exercise.id);
			justAdded = false;
			toasts.show(translate(lang, 'exercise.removed'), 'info', 2600, undefined, 'draft');
			return;
		}
		const result = draft.addToDraft(exercise.id, {
			name: exercise.name,
			equipment: exercise.equipment
		});
		if (result.added) {
			justAdded = true;
			toasts.show(translate(lang, 'exercise.added'), 'success', 2600, undefined, 'draft');
		} else {
			toasts.show(translate(lang, 'exercise.already'), 'info', 2600, undefined, 'draft');
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
				toasts.show(translate(lang, saved ? 'bookmarks.saved' : 'bookmarks.removed'), 'info', 2600, undefined, 'bookmark');
			})
			.finally(() => {
				bookmarkBusy = false;
			});
	}
</script>

{#snippet bookmarkButton(inline: boolean)}
	<AppIconButton
		class={cn(
			'exercise-card-bookmark !min-h-0 !min-w-0 size-auto p-0',
			inline && 'exercise-card-bookmark--inline',
			bookmarked && 'is-active'
		)}
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
	</AppIconButton>
{/snippet}

{#snippet noteBadge(placement: 'list' | 'grid')}
	{#if hasNote}
		<span
			class="exercise-card-note"
			class:exercise-card-note--list={placement === 'list'}
			class:exercise-card-note--grid={placement === 'grid'}
			title={noteText}
			aria-label={translate(lang, 'pr.note')}
		>
			<LucideIcon icon={StickyNote} size={12} class="exercise-card-note-icon" />
		</span>
	{/if}
{/snippet}

{#snippet clipBadge(placement: 'list' | 'grid')}
	{#if hasClip}
		<span
			class="exercise-card-clip"
			class:exercise-card-clip--list={placement === 'list'}
			class:exercise-card-clip--grid={placement === 'grid'}
			aria-label={translate(lang, 'clips.cardBadge')}
			title={translate(lang, 'clips.cardBadge')}
		>
			<LucideIcon icon={Film} size={12} class="exercise-card-clip-icon" />
		</span>
	{/if}
{/snippet}

{#snippet listActions()}
	<div class="exercise-card-actions exercise-card-actions--list">
		<AppIconButton
			class={cn(
				'exercise-card-add exercise-card-add--inline !min-h-0 !min-w-0 size-auto p-0',
				inDraft && 'is-in-draft',
				justAdded && 'is-just-added'
			)}
			onclick={toggleDraft}
			aria-label={translate(lang, inDraft ? 'exercise.removeDraft' : 'exercise.addDraft')}
			aria-pressed={inDraft}
		>
			{#if inDraft}
				<LucideIcon icon={Check} size={ICON_SMALL} class="exercise-card-add-icon" />
			{:else}
				<LucideIcon icon={Plus} size={ICON_SMALL} class="exercise-card-add-icon" />
			{/if}
		</AppIconButton>
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
	class="exercise-card relative min-w-0 max-w-full bg-[var(--color-surface)]"
	class:exercise-card--list={variant === 'list'}
	class:overflow-hidden={variant !== 'list'}
	class:flex={variant !== 'list'}
	class:flex-col={variant !== 'list'}
	class:rounded-[var(--radius-panel)]={variant !== 'list'}
	class:border={variant !== 'list'}
	class:border-[var(--color-border)]={variant !== 'list'}
>
	{#if variant === 'list'}
		<div class="exercise-card-list-main">
			<AppButton
				variant="ghost"
				class="exercise-card-media media-well relative shrink-0 overflow-hidden !min-h-0 !min-w-0 h-auto w-auto p-0"
				aria-label={translate(lang, 'exercise.openTechnique', { name: title })}
				onclick={openTechnique}
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
					draggable="false"
					class={`exercise-card-img pointer-events-none block h-full w-full object-contain ${loaded ? 'is-loaded' : ''}`}
					onload={onImgLoad}
				/>
				{@render noteBadge('list')}
				{@render clipBadge('list')}
			</AppButton>
			<div class="exercise-card-bookmark-slot">
				{@render bookmarkButton(false)}
			</div>
			<a
				href={exerciseHref(exercise.id)}
				class="exercise-card-body flex min-w-0 flex-col gap-0.5"
				aria-label={title}
			>
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
			</a>
		</div>
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
					sizes="(min-width: 1024px) 180px, (min-width: 768px) 33vw, 45vw"
					loading={priority ? 'eager' : 'lazy'}
					fetchpriority={priority ? 'high' : 'auto'}
					decoding="async"
					class={`exercise-card-img block h-full w-full object-contain ${loaded ? 'is-loaded' : ''}`}
					onload={onImgLoad}
				/>
			</a>
			{@render bookmarkButton(false)}
			{@render noteBadge('grid')}
			{@render clipBadge('grid')}
			<AppIconButton
				class={cn(
					'exercise-card-add !min-h-0 !min-w-0 size-auto p-0',
					inDraft && 'is-in-draft',
					justAdded && 'is-just-added'
				)}
				onclick={toggleDraft}
				aria-label={translate(lang, inDraft ? 'exercise.removeDraft' : 'exercise.addDraft')}
				aria-pressed={inDraft}
			>
				{#if inDraft}
					<LucideIcon icon={Check} size={ICON_SMALL} class="exercise-card-add-icon" />
				{:else}
					<LucideIcon icon={Plus} size={ICON_SMALL} class="exercise-card-add-icon" />
				{/if}
			</AppIconButton>
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

{#if techniqueOpen}
	<BottomSheet
		open={techniqueOpen}
		raised
		titleId={`exercise-technique-${exercise.id}`}
		onDismiss={dismissTechnique}
	>
		<CloseIconButton class="bottom-sheet__close" onclick={dismissTechnique} />
		<div class="bottom-sheet__head">
			<p id={`exercise-technique-${exercise.id}`} class="bottom-sheet__title">{title}</p>
		</div>
		<p class="bottom-sheet__hint">{labelTarget(exercise.target, lang)}</p>
		<div class="exercise-technique-sheet__media media-well">
			<img
				src={techniqueSrc}
				alt=""
				width="180"
				height="180"
				decoding="async"
				class="exercise-technique-sheet__img"
				onerror={onTechniqueImgError}
			/>
		</div>
		{#snippet actions()}
			<AppButton block href={exerciseHref(exercise.id)}>
				{translate(lang, 'exercise.openCard')}
			</AppButton>
		{/snippet}
	</BottomSheet>
{/if}
