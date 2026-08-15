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
	import Spinner from '$lib/components/Spinner.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { ArrowLeft, Bookmark, ClipboardList, Plus, Search } from '@lucide/svelte';
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
		if (from?.startsWith('/')) return from;
		if (from === 'workouts' || from?.startsWith('/workouts')) {
			return from.startsWith('/') ? from : '/workouts';
		}
		if (from === 'catalog' || from === 'exercises') return '/exercises';
		return '/exercises';
	});
	let backLabel = $derived.by(() => {
		if (backHref.startsWith('/workouts')) return translate(lang, 'builder.backWorkouts');
		if (backHref.startsWith('/catalog/')) return translate(lang, 'catalog.backToBrowse');
		if (backHref === '/exercises/saved') return translate(lang, 'bookmarks.title');
		return translate(lang, 'catalog.hubTitle');
	});

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
		const result = draft.addToDraft(exercise.id, {
			name: exercise.name,
			equipment: exercise.equipment
		});
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
	<title>{exercise ? `${title} · Repdraft` : `${translate(lang, 'exercise.notFoundTitle')} · Repdraft`}</title>
</svelte:head>

{#if !exercise}
	<EmptyState
		title={translate(lang, 'exercise.notFoundTitle')}
		description={translate(lang, 'exercise.notFoundDesc')}
		actionHref="/exercises"
		actionLabel={translate(lang, 'builder.toCatalog')}
	/>
{:else}
	<article class="content-page content-page--exercise exercise-detail-page pb-mobile-actions lg:pb-0">
		<div class="exercise-detail-page__chrome min-w-0 md:hidden">
			<ScreenHeader {title} {backHref} actions={exerciseHeaderActions} />
		</div>
		<div class="exercise-detail-page__chrome catalog-subroute-header">
			<a class="catalog-zone-crumb-link" href={backHref}>
				<LucideIcon icon={ArrowLeft} size={ICON_SMALL} />
				{backLabel}
			</a>
			<div class="page-header page-header--compact catalog-zone-head">
				<h1 class="page-title catalog-zone-title">{title}</h1>
			</div>
		</div>

		<div class="exercise-detail-page__layout">
			<div class="exercise-detail-page__primary">
				<div class="exercise-detail-page__hero">
					<div class="exercise-detail-page__media">
						<button
							type="button"
							class="exercise-media-frame"
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
								class="exercise-media-native pointer-events-none block"
							/>
							<span class="exercise-media-frame__zoom" aria-hidden="true">
								<LucideIcon icon={Search} size={ICON_SMALL} />
							</span>
						</button>
					</div>

					<div class="exercise-detail-page__intro">
						<div class="flex min-w-0 items-start justify-between gap-3">
							<p class="min-w-0 text-sm">
								<a
									class="exercise-facet-link exercise-facet-link--muted"
									href={catalogZonePath(exercise.body_part)}
								>
									{labelBodyPart(exercise.body_part, lang)}
								</a>
							</p>
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

						<dl class="panel grid min-w-0 gap-3 !p-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
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
							<div class="min-w-0 sm:col-span-2 xl:col-span-1">
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
					</div>
				</div>

				<section class="min-w-0 max-w-full">
					<h2 class="section-title mb-2">{translate(lang, 'exercise.howTo')}</h2>
					<ol class="list-decimal space-y-2.5 pl-5 text-sm leading-relaxed break-words text-[var(--color-ink)] lg:columns-2 lg:gap-x-8 xl:columns-1">
						{#each steps as step, i (i)}
							<li class="min-w-0 break-inside-avoid">{step}</li>
						{/each}
					</ol>
				</section>
			</div>

			<aside class="exercise-detail-page__aside">
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
			</aside>
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
				<div class="exercise-media-lightbox">
					<img
						src={`/${exercise.gif_url}`}
						alt={title}
						width="180"
						height="180"
						decoding="async"
						class="exercise-media-native--lightbox"
					/>
				</div>
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
