<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SegmentControl from '$lib/components/SegmentControl.svelte';
	import { catalogEquipmentPath, catalogTargetPath, catalogZonePath, withFromParam } from '$lib/domain/catalogLinks';
	import { currentReturnPath, linkWithFrom, resolveBackFrom } from '$lib/domain/navigation';
	import {
		labelBodyPart,
		labelEquipment,
		labelTarget
	} from '$lib/domain/labels.ru';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import JsonLd from '$lib/seo/JsonLd.svelte';
import { buildExerciseHowToJsonLd } from '$lib/seo/jsonLd';
import { exerciseOgImagePath } from '$lib/seo/prerenderPublic';
import { truncateMeta } from '$lib/seo/site';
	import { resolveSeoLang } from '$lib/seo/seoLang';
	import { resolveSiteOrigin } from '$lib/seo/site';
	import { backLabelForHref } from '$lib/i18n/backLabel';
	import { cn } from '$lib/utils.js';
	import { draft } from '$lib/stores/draft';
	import { bookmarks } from '$lib/stores/bookmarks';
	import { resolvedLocale } from '$lib/stores/locale';
	import { blurActiveElement } from '$lib/dom/blurActiveElement';
	import { onboarding } from '$lib/stores/onboarding';
	import { shouldShowCoachmark } from '$lib/domain/onboarding';
	import { toasts } from '$lib/stores/toasts';
	import PersonalRecordPanel from '$lib/components/PersonalRecordPanel.svelte';
	import ExerciseSessionHistory from '$lib/components/ExerciseSessionHistory.svelte';
	import TechniqueClipsPanel from '$lib/components/TechniqueClipsPanel.svelte';
	import Coachmark from '$lib/components/onboarding/Coachmark.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import { Bookmark, ClipboardList, Plus } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	type ExerciseDetailTab = 'description' | 'history' | 'record' | 'muscles';

	let { data } = $props();

	let exercise = $derived(data.exercise);
	let lang = $derived($resolvedLocale);
	let seoLang = $derived(resolveSeoLang($page.data.seoLocale, lang));
	let showExerciseTabsCoachmark = $derived(shouldShowCoachmark($onboarding, 'exercise.tabs'));
	let relatedArticles = $derived.by(() => {
		const forLocale = data.relatedArticles.filter((a) => a.locale === lang);
		return forLocale.length > 0
			? forLocale
			: data.relatedArticles.filter((a) => a.locale === 'ru');
	});
	let title = $derived(exercise ? exerciseName(exercise, lang) : '');
	let draftCount = $derived($draft.exercises.length);
	let steps = $derived.by(() => {
		if (!exercise) return [] as string[];
		const map = exercise.instruction_steps ?? {};
		return map[lang] ?? map.ru ?? map.en ?? [];
	});
	let seoDescription = $derived.by(() => {
		if (!exercise) return translate(seoLang, 'app.metaDescription');
		const fromStep = steps[0]?.trim();
		if (fromStep) return truncateMeta(fromStep);
		return translate(seoLang, 'seo.exerciseDescription', { name: title });
	});
	let seoImage = $derived(exerciseOgImagePath(exercise));
	let seoPath = $derived(exercise ? `/exercise/${encodeURIComponent(exercise.id)}` : undefined);
	let siteOrigin = $derived(resolveSiteOrigin($page.url.origin));
	let exerciseJsonLd = $derived.by(() => {
		if (!exercise || steps.length === 0) return null;
		return buildExerciseHowToJsonLd(siteOrigin, exercise, seoLang, steps.slice(0, 8));
	});
	let bookmarkBusy = $state(false);
	let inDraft = $derived(
		Boolean(exercise && $draft.exercises.some((ex) => ex.exerciseId === exercise.id))
	);
	let bookmarked = $derived(Boolean(exercise && $bookmarks.includes(exercise.id)));
	/** After tabs tip: teach bookmark without stacking two coachmarks. */
	let showExerciseBookmarkCoachmark = $derived(
		!showExerciseTabsCoachmark &&
			!bookmarked &&
			shouldShowCoachmark($onboarding, 'exercise.bookmark')
	);
	let returnPath = $derived(currentReturnPath($page.url.pathname, $page.url.searchParams));
	let backHref = $derived(resolveBackFrom($page.url.searchParams.get('from')));
	let backLabel = $derived(backLabelForHref(backHref, lang));
	let activeTab = $state<ExerciseDetailTab>('description');
	let detailTabOptions = $derived([
		{ id: 'description', label: translate(lang, 'exercise.tabDescription') },
		{ id: 'history', label: translate(lang, 'exercise.tabHistory') },
		{ id: 'record', label: translate(lang, 'exercise.tabRecord') },
		{ id: 'muscles', label: translate(lang, 'exercise.tabMuscles') }
	]);
	onMount(() => {
		void bookmarks.refresh();
	});

	function toggleBookmark() {
		if (!exercise || bookmarkBusy) return;
		bookmarkBusy = true;
		void bookmarks
			.toggle(exercise.id)
			.then((saved) => {
				if (saved) {
					onboarding.dismissCoachmark('exercise.bookmark');
					onboarding.dismissCoachmark('bookmarks.empty');
					toasts.show(translate(lang, 'bookmarks.saved'), 'info', 2600, undefined, 'bookmark');
					return;
				}
				toasts.showUndo(
					translate(lang, 'bookmarks.removed'),
					() => void bookmarks.toggle(exercise.id),
					'info',
					undefined,
					'bookmark'
				);
			})
			.finally(() => {
				bookmarkBusy = false;
			});
	}

	function toggleDraft() {
		if (!exercise) return;
		if (inDraft) {
			draft.removeFromDraft(exercise.id);
			toasts.show(translate(lang, 'exercise.removed'), 'info', 2600, undefined, 'draft');
			return;
		}
		const result = draft.addToDraft(exercise.id, {
			name: exercise.name,
			equipment: exercise.equipment
		});
		if (result.added) {
			toasts.show(translate(lang, 'exercise.added'), 'success', 2600, undefined, 'draft');
		} else {
			toasts.show(translate(lang, 'exercise.already'), 'info', 2600, undefined, 'draft');
		}
	}

	function setActiveTab(tab: string) {
		switch (tab) {
			case 'description':
			case 'history':
			case 'record':
			case 'muscles':
				activeTab = tab;
				return;
			default:
				return;
		}
	}
</script>

{#snippet exerciseHeaderActions()}
	<AppButton
		variant="ghost"
		class={cn('exercise-detail-bookmark shrink-0', bookmarked && 'is-active')}
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
	</AppButton>
{/snippet}

<SeoHead
	title={exercise ? title : translate(seoLang, 'exercise.notFoundTitle')}
	description={seoDescription}
	path={seoPath}
	image={seoImage}
	noindex={!exercise}
/>

{#if exerciseJsonLd}
	<JsonLd data={exerciseJsonLd} />
{/if}

<svelte:head>
	{#if exercise}
		<link rel="preload" as="image" href={`/${exercise.gif_url}`} fetchpriority="high" />
	{/if}
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
		<div class="exercise-detail-page__chrome min-w-0">
			<ScreenHeader fixed {title} {backHref} backLabelVisible {backLabel} actions={exerciseHeaderActions} />
		</div>

		<div class="exercise-detail-page__layout">
			<div class="exercise-detail-page__primary">
				<div class="exercise-detail-page__hero">
					<div class="exercise-detail-page__media">
						<div class="exercise-media-frame">
							<img
								src={`/${exercise.gif_url}`}
								alt={title}
								width="180"
								height="180"
								loading="eager"
								fetchpriority="high"
								decoding="async"
								class="exercise-media-native block"
							/>
						</div>
					</div>

					<div class="exercise-detail-page__intro">
						<div class="exercise-detail-page__toolbar">
							<AppButton
								variant="ghost"
								class={cn(
									'exercise-detail-bookmark exercise-detail-bookmark--page shrink-0',
									bookmarked && 'is-active'
								)}
								onclick={toggleBookmark}
								aria-label={translate(lang, bookmarked ? 'bookmarks.remove' : 'bookmarks.add')}
								aria-pressed={bookmarked}
							>
								<LucideIcon icon={Bookmark} size={ICON_BUTTON + 2} fill={bookmarked ? 'currentColor' : 'none'} />
							</AppButton>
						</div>
						{#if showExerciseBookmarkCoachmark}
							<Coachmark
								class="mt-2"
								message={translate(lang, 'onboarding.coachExerciseBookmark')}
								onDismiss={() => {
									onboarding.dismissCoachmark('exercise.bookmark');
									blurActiveElement();
								}}
							/>
						{/if}

						<div class="actions-inline" class:actions-inline--pair={inDraft}>
							{#if inDraft}
								<AppButton
									href="/builder"
									class="exercise-detail-actions__btn inline-flex items-center justify-center gap-1.5"
								>
									<LucideIcon icon={ClipboardList} size={ICON_BUTTON} />
									{translate(lang, 'draft.dock', { n: draftCount })}
								</AppButton>
								<AppButton
									variant="secondary"
									class="exercise-detail-actions__btn"
									onclick={toggleDraft}
								>
									{translate(lang, 'exercise.removeDraft')}
								</AppButton>
							{:else}
								<AppButton onclick={toggleDraft}>
									<span class="inline-flex items-center gap-1.5">
										<LucideIcon icon={Plus} size={ICON_BUTTON} />
										{translate(lang, 'exercise.addDraft')}
									</span>
								</AppButton>
							{/if}
						</div>
					</div>
				</div>

				<section class="exercise-detail-tabs" aria-labelledby="exercise-detail-tabs-title">
					<h2 id="exercise-detail-tabs-title" class="sr-only">
						{translate(lang, 'exercise.tabsAria')}
					</h2>
					<div class="exercise-detail-tabs__nav">
						<SegmentControl
							options={detailTabOptions}
							value={activeTab}
							onchange={setActiveTab}
							ariaLabel={translate(lang, 'exercise.tabsAria')}
						/>
					</div>
					{#if showExerciseTabsCoachmark}
						<Coachmark
							class="mt-3"
							message={translate(lang, 'onboarding.coachExerciseTabs')}
							onDismiss={() => {
								onboarding.dismissCoachmark('exercise.tabs');
								blurActiveElement();
							}}
						/>
					{/if}

					{#if activeTab === 'description'}
						<div class="exercise-detail-tab-panel">
							<AppPanel class="exercise-detail-steps min-w-0 max-w-full">
								<h2 class="section-title mb-2">{translate(lang, 'exercise.howTo')}</h2>
								<ol
									class="exercise-detail-steps__list list-decimal space-y-2.5 pl-5 text-sm break-words text-[var(--color-ink)] lg:columns-2 lg:gap-x-8 xl:columns-1"
								>
									{#each steps as step, i (i)}
										<li class="min-w-0 break-inside-avoid">{step}</li>
									{/each}
								</ol>
							</AppPanel>

							{#if relatedArticles.length > 0}
								<section class="exercise-related-articles">
									<h2 class="section-title mb-2">{translate(lang, 'articles.relatedTitle')}</h2>
									<ul class="exercise-related-articles__list">
										{#each relatedArticles as article (article.slug)}
											<li>
												<a
													class="exercise-related-articles__link"
													href={linkWithFrom(`/articles/${article.slug}`, returnPath)}
												>
													<span class="exercise-related-articles__title">{article.title}</span>
													<span class="exercise-related-articles__excerpt">{article.excerpt}</span>
												</a>
											</li>
										{/each}
									</ul>
								</section>
							{/if}

							{#if exercise}
								<TechniqueClipsPanel exerciseId={exercise.id} />
							{/if}
						</div>
					{:else if activeTab === 'history'}
						<div class="exercise-detail-tab-panel">
							<ExerciseSessionHistory exerciseId={exercise.id} />
						</div>
					{:else if activeTab === 'record'}
						<div class="exercise-detail-tab-panel">
							<PersonalRecordPanel exerciseId={exercise.id} bodyPart={exercise.body_part} embedded />
						</div>
					{:else}
						<div class="exercise-detail-tab-panel">
							<AppPanel class="exercise-detail-muscles grid min-w-0 gap-3 !p-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
								<div class="min-w-0">
									<dt class="text-[var(--color-muted)]">{translate(lang, 'exercise.bodyPart')}</dt>
									<dd class="font-medium break-words">
										<a class="exercise-facet-link" href={withFromParam(catalogZonePath(exercise.body_part), returnPath)}>
											{labelBodyPart(exercise.body_part, lang)}
										</a>
									</dd>
								</div>
								<div class="min-w-0">
									<dt class="text-[var(--color-muted)]">{translate(lang, 'exercise.equipment')}</dt>
									<dd class="font-medium break-words">
										<a
											class="exercise-facet-link"
											href={withFromParam(
												catalogEquipmentPath(exercise.body_part, exercise.equipment),
												returnPath
											)}
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
											href={withFromParam(
												catalogTargetPath(exercise.target, exercise.body_part),
												returnPath
											)}
										>
											{labelTarget(exercise.target, lang)}
										</a>
									</dd>
								</div>
								<div class="min-w-0 sm:col-span-2 xl:col-span-3">
									<dt class="text-[var(--color-muted)]">{translate(lang, 'exercise.secondary')}</dt>
									<dd class="font-medium break-words">
										{#if exercise.secondary_muscles.length}
											{#each exercise.secondary_muscles as muscle, i (muscle)}
												{#if i > 0}<span class="text-[var(--color-muted)]">, </span>{/if}
												<a class="exercise-facet-link" href={withFromParam(catalogTargetPath(muscle), returnPath)}>
													{labelTarget(muscle, lang)}
												</a>
											{/each}
										{:else}
											{translate(lang, 'exercise.dash')}
										{/if}
									</dd>
								</div>
							</AppPanel>
						</div>
					{/if}
				</section>
			</div>
		</div>
	</article>

	<div class="sticky-actions lg:hidden">
		<div class="sticky-actions__inner exercise-detail-sticky" class:exercise-detail-sticky--pair={inDraft}>
			{#if inDraft}
				<AppButton
					href="/builder"
					class="exercise-detail-sticky__btn inline-flex items-center justify-center gap-1.5"
				>
					<LucideIcon icon={ClipboardList} size={ICON_BUTTON} />
					{translate(lang, 'draft.dock', { n: draftCount })}
				</AppButton>
				<AppButton
					variant="secondary"
					class="exercise-detail-sticky__btn exercise-detail-remove-draft"
					onclick={toggleDraft}
				>
					{translate(lang, 'exercise.removeDraft')}
				</AppButton>
			{:else}
				<AppButton block onclick={toggleDraft}>
					<span class="inline-flex items-center justify-center gap-1.5">
						<LucideIcon icon={Plus} size={ICON_BUTTON} />
						{translate(lang, 'exercise.toDraft')}
					</span>
				</AppButton>
			{/if}
		</div>
	</div>
{/if}
