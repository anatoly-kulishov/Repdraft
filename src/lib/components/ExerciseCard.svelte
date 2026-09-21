<script lang="ts">
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { labelEquipment, labelTarget } from '$lib/domain/labels.ru';
	import { translate } from '$lib/i18n/messages';
	import { draft } from '$lib/stores/draft';
	import { bookmarks } from '$lib/stores/bookmarks';
	import { get } from 'svelte/store';
	import { records } from '$lib/stores/records';
	import { techniqueClipHints } from '$lib/stores/techniqueClipHints';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import AppIconButton from '$lib/components/AppIconButton.svelte';
	import ExpandableText from '$lib/components/ExpandableText.svelte';
	import { cn } from '$lib/utils.js';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { linkWithFrom } from '$lib/domain/navigation';
	import { hasFadedInMedia, markFadedInMedia } from '$lib/media/mediaFadeCache';
	import { blurActiveElement } from '$lib/dom/blurActiveElement';
	import {
		armExerciseMediaViewTransition,
		armedExerciseMediaVtId,
		exerciseMediaViewTransitionName
	} from '$lib/dom/exerciseMediaViewTransition';
	import { Bookmark, Check, Dumbbell, Film, Plus, StickyNote, Target } from '@lucide/svelte';

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
	let mediaVtName = $derived(
		$armedExerciseMediaVtId === exercise.id
			? exerciseMediaViewTransitionName(exercise.id)
			: undefined
	);
	let mediaEl = $state<HTMLElement | null>(null);
	let imageSrc = $derived(`/${exercise.image}`);
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
	let imgLoading = $derived(
		priority || hasFadedInMedia(imageSrc) ? ('eager' as const) : ('lazy' as const)
	);

	$effect.pre(() => {
		loaded = hasFadedInMedia(`/${exercise.image}`);
	});

	$effect(() => {
		const img = imgEl;
		const src = `/${exercise.image}`;
		if (hasFadedInMedia(src)) {
			loaded = true;
			return;
		}
		if (img?.complete && img.naturalWidth > 0) {
			markFadedInMedia(src);
			loaded = true;
		}
	});

	function onImgLoad() {
		markFadedInMedia(`/${exercise.image}`);
		loaded = true;
	}

	function exerciseHref(id: string): string {
		if (!detailFrom) return `/exercise/${id}`;
		return linkWithFrom(`/exercise/${id}`, detailFrom);
	}

	/** Arm shared VT before navigation so startViewTransition captures the named card. */
	function armMediaVt() {
		armExerciseMediaViewTransition(exercise.id);
		/* Imperative: store→DOM may not flush before click → onNavigate capture. */
		if (mediaEl) {
			mediaEl.style.viewTransitionName = exerciseMediaViewTransitionName(exercise.id);
		}
	}

	function toggleDraft(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (inDraft) {
			draft.removeFromDraft(exercise.id);
			justAdded = false;
			// Catalog: card + / dock badge already confirm; toast stacks with the dock.
		} else {
			const result = draft.addToDraft(exercise.id, {
				name: exercise.name,
				equipment: exercise.equipment
			});
			if (result.added) {
				justAdded = true;
				// Catalog: card check + draft-dock badge already confirm. A toast
				// stacks with the dock coachmark into a bottom pyramid.
			} else {
				toasts.show(translate(lang, 'exercise.already'), 'info', 2600, undefined, 'draft');
			}
		}
		/* iOS keeps :hover/:focus fill on the + after tap (looks “stuck” after cancel/remove). */
		const target = event.currentTarget;
		if (target instanceof HTMLElement) target.blur();
		else blurActiveElement();
	}

	function toggleBookmark(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (bookmarkBusy) return;
		bookmarkBusy = true;
		const restoreIndex = get(bookmarks).indexOf(exercise.id);
		void bookmarks
			.toggle(exercise.id)
			.then((saved) => {
				if (saved) {
					toasts.show(translate(lang, 'bookmarks.saved'), 'info', 2600, {
						href: '/exercises/saved',
						label: translate(lang, 'bookmarks.title')
					}, 'bookmark');
					return;
				}
				toasts.showUndo(
					translate(lang, 'bookmarks.removed'),
					() => void bookmarks.restoreAt(exercise.id, restoreIndex),
					'info',
					undefined,
					'bookmark'
				);
			})
			.finally(() => {
				bookmarkBusy = false;
			});
	}
</script>

{#snippet bookmarkButton(inline: boolean)}
	<AppIconButton
		class={cn(
			'exercise-card-bookmark p-0 !min-h-0 !min-w-0 size-auto',
			inline ? 'exercise-card-bookmark--inline' : '',
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
				'exercise-card-add exercise-card-add--inline exercise-card-list-action !size-12 !min-h-12 !min-w-12 !rounded-full !bg-transparent p-0 hover:!bg-transparent',
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
			<div class="exercise-card-list-thumb">
				<a
					bind:this={mediaEl}
					href={exerciseHref(exercise.id)}
					class="exercise-card-media media-well relative shrink-0 overflow-hidden"
					style:view-transition-name={mediaVtName}
					onpointerdown={armMediaVt}
					aria-label={title}
				>
					<img
						bind:this={imgEl}
						src={`/${exercise.image}`}
						alt=""
						width="120"
						height="120"
						sizes="120px"
						loading={imgLoading}
						fetchpriority={priority ? 'high' : 'auto'}
						decoding="async"
						draggable="false"
						class={`exercise-card-img pointer-events-none block h-full w-full object-contain ${loaded ? 'is-loaded' : ''}`}
						onload={onImgLoad}
					/>
					{@render noteBadge('list')}
					{@render clipBadge('list')}
				</a>
				<div class="exercise-card-bookmark-slot">
					{@render bookmarkButton(false)}
				</div>
			</div>
			<a
				href={exerciseHref(exercise.id)}
				class="exercise-card-body flex min-w-0 flex-col gap-0.5"
				onpointerdown={armMediaVt}
				aria-label={title}
			>
				<span class="exercise-card-list-title font-semibold leading-snug text-[var(--color-ink)]">
					<ExpandableText text={title} lines={2} class="exercise-card-list-title__text" />
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
			bind:this={mediaEl}
			class="exercise-card-media exercise-card-media--grid media-well relative aspect-square min-w-0 overflow-hidden"
			style:view-transition-name={mediaVtName}
		>
			<a
				href={exerciseHref(exercise.id)}
				class="exercise-card-media-link absolute inset-0 active:bg-[var(--color-surface-muted)]"
				onpointerdown={armMediaVt}
				aria-label={title}
			>
				<img
					bind:this={imgEl}
					src={`/${exercise.image}`}
					alt=""
					sizes="(min-width: 1024px) 180px, (min-width: 768px) 33vw, 45vw"
					loading={imgLoading}
					fetchpriority={priority ? 'high' : 'auto'}
					decoding="async"
					draggable="false"
					class={`exercise-card-img pointer-events-none block h-full w-full object-contain ${loaded ? 'is-loaded' : ''}`}
					onload={onImgLoad}
				/>
			</a>
			{@render bookmarkButton(false)}
			{@render noteBadge('grid')}
			{@render clipBadge('grid')}
			<AppIconButton
				class={cn(
					'exercise-card-add p-0',
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
			class="exercise-card-body exercise-card-body--grid flex min-w-0 flex-1 flex-col gap-1 p-2.5 active:bg-[var(--color-surface-muted)]"
			onpointerdown={armMediaVt}
		>
			<h2 class="exercise-card-grid-title text-[13px] font-semibold leading-snug">
				<ExpandableText text={title} lines={2} as="span" class="exercise-card-grid-title__text" />
			</h2>
			<div class="exercise-card-grid-meta">
				<span class="exercise-card-grid-meta-item" title={labelTarget(exercise.target, lang)}>
					<LucideIcon icon={Target} size={12} class="exercise-card-grid-meta-icon" />
					<span class="truncate">{labelTarget(exercise.target, lang)}</span>
				</span>
				<span
					class="exercise-card-grid-meta-item exercise-card-grid-meta-item--equipment"
					title={labelEquipment(exercise.equipment, lang)}
				>
					<LucideIcon icon={Dumbbell} size={12} class="exercise-card-grid-meta-icon" />
					<span class="truncate">{labelEquipment(exercise.equipment, lang)}</span>
				</span>
			</div>
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
