<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import {
		catalogEquipmentPath,
		catalogTargetPath,
		catalogZonePath
	} from '$lib/domain/catalogLinks';
	import {
		labelBodyPart,
		labelEquipment,
		labelTarget
	} from '$lib/domain/labels.ru';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { translate } from '$lib/i18n/messages';
	import { draft } from '$lib/stores/draft';
	import { bookmarks } from '$lib/stores/bookmarks';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import PersonalRecordPanel from '$lib/components/PersonalRecordPanel.svelte';
	import TechniqueClipsPanel from '$lib/components/TechniqueClipsPanel.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { Bookmark, ClipboardList, Plus, Search } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { data } = $props();

	let exercise = $derived(data.exercise);
	let lang = $derived($resolvedLocale);
	let title = $derived(exercise ? exerciseName(exercise, lang) : '');
	let draftCount = $derived($draft.exercises.length);
	let steps = $derived.by(() => {
		if (!exercise) return [] as string[];
		const map = exercise.instruction_steps ?? {};
		return map[lang] ?? map.ru ?? map.en ?? [];
	});
	let mediaOpen = $state(false);
	let mediaCloseBtn: HTMLButtonElement | undefined = $state();
	let bookmarkBusy = $state(false);
	let inDraft = $derived(
		Boolean(exercise && $draft.exercises.some((ex) => ex.exerciseId === exercise.id))
	);
	let bookmarked = $derived(Boolean(exercise && $bookmarks.includes(exercise.id)));
	let backHref = $derived.by(() => {
		const from = $page.url.searchParams.get('from');
		if (from === 'workouts' || from?.startsWith('/workouts')) {
			return from.startsWith('/') ? from : '/workouts';
		}
		if (from === 'catalog' || from === 'exercises') return '/exercises';
		return '/exercises';
	});
	let backLabel = $derived(
		backHref.startsWith('/workouts')
			? translate(lang, 'builder.backWorkouts')
			: translate(lang, 'catalog.hubTitle')
	);

	onMount(() => {
		void bookmarks.refresh();
	});

	function toggleBookmark() {
		if (!exercise || bookmarkBusy) return;
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

	function toggleDraft() {
		if (!exercise) return;
		if (inDraft) {
			draft.removeFromDraft(exercise.id);
			toasts.show(translate(lang, 'exercise.removed'), 'info');
			return;
		}
		const result = draft.addToDraft(exercise.id);
		if (result.added) {
			toasts.show(translate(lang, 'exercise.added'), 'success');
		} else {
			toasts.show(translate(lang, 'exercise.already'), 'info');
		}
	}

	function openMedia() {
		mediaOpen = true;
	}

	function closeMedia() {
		mediaOpen = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && mediaOpen) closeMedia();
	}

	$effect(() => {
		if (!mediaOpen) return;
		queueMicrotask(() => mediaCloseBtn?.focus());
	});

	$effect(() => {
		if (typeof document === 'undefined' || !mediaOpen) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	});
</script>

{#snippet exerciseHeaderActions()}
	<button
		type="button"
		class="btn-ghost exercise-detail-bookmark shrink-0"
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
			<LucideIcon icon={Bookmark} size={ICON_BUTTON + 2} fill={bookmarked ? 'currentColor' : 'none'} />
		{/if}
	</button>
{/snippet}

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>{exercise ? `${title} — Repdraft` : `${translate(lang, 'exercise.notFoundTitle')} — Repdraft`}</title>
</svelte:head>

{#if !exercise}
	<EmptyState
		title={translate(lang, 'exercise.notFoundTitle')}
		description={translate(lang, 'exercise.notFoundDesc')}
		actionHref="/exercises"
		actionLabel={translate(lang, 'builder.toCatalog')}
	/>
{:else}
	<article class="content-page content-page--wide grid w-full min-w-0 max-w-full gap-5 pb-mobile-actions lg:grid-cols-[280px_1fr] lg:gap-6 lg:pb-0">
		<div class="col-span-full min-w-0 md:hidden">
			<ScreenHeader {title} {backHref} actions={exerciseHeaderActions} />
		</div>
		<div class="subroute-desktop-head col-span-full hidden min-w-0 md:block">
			<SubrouteBack href={backHref} label={backLabel} />
		</div>
		<div class="min-w-0 max-w-full">
			<button
				type="button"
				class="panel relative flex w-full cursor-zoom-in items-center justify-center overflow-hidden !p-4 sm:!p-5 lg:!p-3"
				aria-label={translate(lang, 'exercise.openMedia')}
				onclick={openMedia}
			>
				<img
					src={`/${exercise.gif_url}`}
					alt={title}
					width="180"
					height="180"
					fetchpriority="high"
					decoding="async"
					class="pointer-events-none block h-[180px] w-[180px] max-w-full object-contain max-md:h-[220px] max-md:w-[min(100%,220px)]"
				/>
				<span
					class="pointer-events-none absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] text-[var(--color-muted)] shadow-sm backdrop-blur-[2px]"
					aria-hidden="true"
				>
					<LucideIcon icon={Search} size={ICON_SMALL} />
				</span>
			</button>
		</div>

		<div class="flex min-w-0 max-w-full flex-col gap-4 md:gap-6">
			<div class="flex min-w-0 items-start justify-between gap-3">
				<div class="min-w-0">
					<p class="text-sm">
						<a
							class="exercise-facet-link exercise-facet-link--muted"
							href={catalogZonePath(exercise.body_part)}
						>
							{labelBodyPart(exercise.body_part, lang)}
						</a>
					</p>
					<h1 class="page-title hidden lg:block">{title}</h1>
				</div>
				<button
					type="button"
					class="btn-ghost exercise-detail-bookmark exercise-detail-bookmark--page shrink-0"
					class:is-active={bookmarked}
					onclick={toggleBookmark}
					aria-label={translate(lang, bookmarked ? 'bookmarks.remove' : 'bookmarks.add')}
					aria-pressed={bookmarked}
				>
					<LucideIcon icon={Bookmark} size={ICON_BUTTON + 2} fill={bookmarked ? 'currentColor' : 'none'} />
				</button>
			</div>

			<dl class="panel grid min-w-0 gap-3 !p-3 text-sm sm:grid-cols-2">
				<div class="min-w-0">
					<dt class="text-[var(--color-muted)]">{translate(lang, 'exercise.equipment')}</dt>
					<dd class="font-medium break-words">
						<a
							class="exercise-facet-link"
							href={catalogEquipmentPath(exercise.body_part, exercise.equipment)}
						>
							{labelEquipment(exercise.equipment, lang)}
						</a>
					</dd>
				</div>
				<div class="min-w-0">
					<dt class="text-[var(--color-muted)]">{translate(lang, 'exercise.target')}</dt>
					<dd class="font-medium break-words">
						<a
							class="exercise-facet-link"
							href={catalogTargetPath(exercise.target, exercise.body_part)}
						>
							{labelTarget(exercise.target, lang)}
						</a>
					</dd>
				</div>
				<div class="min-w-0 sm:col-span-2">
					<dt class="text-[var(--color-muted)]">{translate(lang, 'exercise.secondary')}</dt>
					<dd class="font-medium break-words">
						{#if exercise.secondary_muscles.length}
							{#each exercise.secondary_muscles as muscle, i (muscle)}
								{#if i > 0}<span class="text-[var(--color-muted)]">, </span>{/if}
								<a class="exercise-facet-link" href={catalogTargetPath(muscle)}>
									{labelTarget(muscle, lang)}
								</a>
							{/each}
						{:else}
							{translate(lang, 'exercise.dash')}
						{/if}
					</dd>
				</div>
			</dl>

			<div class="actions-inline">
				{#if inDraft}
					<a class="btn-primary inline-flex items-center gap-1.5" href="/builder">
						<LucideIcon icon={ClipboardList} size={ICON_BUTTON} />
						{translate(lang, 'draft.dock', { n: draftCount })}
					</a>
					<button type="button" class="btn-link text-sm" onclick={toggleDraft}>
						{translate(lang, 'exercise.removeDraft')}
					</button>
				{:else}
					<button type="button" class="btn-primary" onclick={toggleDraft}>
						<span class="inline-flex items-center gap-1.5">
							<LucideIcon icon={Plus} size={ICON_BUTTON} />
							{translate(lang, 'exercise.addDraft')}
						</span>
					</button>
				{/if}
			</div>

			<section class="min-w-0 max-w-full">
				<h2 class="section-title mb-2">{translate(lang, 'exercise.howTo')}</h2>
				<ol class="list-decimal space-y-2.5 pl-5 text-sm leading-relaxed break-words text-[var(--color-ink)]">
					{#each steps as step, i (i)}
						<li class="min-w-0">{step}</li>
					{/each}
				</ol>
			</section>

			<PersonalRecordPanel exerciseId={exercise.id} />

			{#if data.relatedArticles.length > 0}
				<section class="exercise-related-articles">
					<h2 class="section-title mb-2">{translate(lang, 'articles.relatedTitle')}</h2>
					<ul class="exercise-related-articles__list">
						{#each data.relatedArticles as article (article.slug)}
							<li>
								<a class="exercise-related-articles__link" href={`/articles/${article.slug}`}>
									<span class="exercise-related-articles__title">{article.title}</span>
									<span class="exercise-related-articles__excerpt">{article.excerpt}</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<TechniqueClipsPanel exerciseId={exercise.id} />
		</div>
	</article>

	<div class="sticky-actions lg:hidden" class:sticky-actions--stack={inDraft}>
		<div class="sticky-actions__inner flex flex-col gap-1">
			{#if inDraft}
				<a class="btn-primary btn-block inline-flex items-center justify-center gap-1.5" href="/builder">
					<LucideIcon icon={ClipboardList} size={ICON_BUTTON} />
					{translate(lang, 'draft.dock', { n: draftCount })}
				</a>
				<button
					type="button"
					class="btn-link mx-auto !min-h-9 !text-[var(--color-muted)]"
					onclick={toggleDraft}
				>
					{translate(lang, 'exercise.removeDraft')}
				</button>
			{:else}
				<button type="button" class="btn-primary btn-block" onclick={toggleDraft}>
					<span class="inline-flex items-center justify-center gap-1.5">
						<LucideIcon icon={Plus} size={ICON_BUTTON} />
						{translate(lang, 'exercise.toDraft')}
					</span>
				</button>
			{/if}
		</div>
	</div>

	{#if mediaOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 pb-[calc(var(--safe-bottom)+1rem)]"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			aria-label={title}
			onclick={(e) => {
				if (e.target === e.currentTarget) closeMedia();
			}}
		>
			<div class="flex w-full max-w-lg flex-col items-center gap-3">
				<img
					src={`/${exercise.gif_url}`}
					alt={title}
					width="180"
					height="180"
					decoding="async"
					class="aspect-square w-[min(100%,22rem)] max-h-[min(80vh,28rem)] rounded-[var(--radius-panel)] bg-[var(--color-surface)] object-contain shadow-xl"
				/>
				<button
					type="button"
					class="btn-secondary"
					bind:this={mediaCloseBtn}
					onclick={closeMedia}
				>
					{translate(lang, 'exercise.closeMedia')}
				</button>
			</div>
		</div>
	{/if}
{/if}
