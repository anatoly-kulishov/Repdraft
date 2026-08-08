<script lang="ts">
	import type { TechniqueClip } from '$lib/domain/clips';
	import { listRecentClips } from '$lib/storage/techniqueClipsRepository';
	import { translate } from '$lib/i18n/messages';
	import { isSupabaseConfigured } from '$lib/supabase/client';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		exerciseNames = new Map<string, string>(),
		/** Parent flips this after first paint / idle so GIFs don't compete with LCP. */
		start = false
	}: {
		exerciseNames?: Map<string, string>;
		start?: boolean;
	} = $props();

	let clips = $state<TechniqueClip[]>([]);
	let loading = $state(false);
	let failed = $state(false);
	let loadedIds = $state(new Set<string>());
	let lang = $derived($resolvedLocale);
	let showShell = $derived(isSupabaseConfigured());
	let showSkeletons = $derived(showShell && (!start || loading));

	$effect(() => {
		if (!start || !isSupabaseConfigured()) {
			return;
		}
		let cancelled = false;
		loading = true;
		failed = false;
		listRecentClips(16)
			.then((rows) => {
				if (!cancelled) {
					clips = rows;
					loadedIds = new Set();
					loading = false;
				}
			})
			.catch(() => {
				if (!cancelled) {
					failed = true;
					clips = [];
					loading = false;
				}
			});
		return () => {
			cancelled = true;
		};
	});

	function exerciseLabel(exerciseId: string): string {
		return exerciseNames.get(exerciseId) ?? translate(lang, 'feed.exercise');
	}

	function markLoaded(id: string) {
		if (loadedIds.has(id)) return;
		loadedIds = new Set(loadedIds).add(id);
	}
</script>

{#if showShell && (showSkeletons || clips.length > 0 || failed)}
	<section class="mb-8" aria-labelledby="community-feed-heading">
		<div class="mb-3">
			<h2 id="community-feed-heading" class="section-title">
				{translate(lang, 'feed.title')}
			</h2>
			<p class="mt-1 text-sm text-[var(--color-muted)]">{translate(lang, 'feed.lead')}</p>
		</div>

		{#if failed && !showSkeletons}
			<p class="text-xs text-[var(--color-muted)]">{translate(lang, 'feed.fail')}</p>
		{:else if showSkeletons}
			<ul
				class="-mx-4 flex gap-2.5 overflow-hidden px-4 pb-1 md:mx-0 md:px-0"
				aria-busy="true"
				aria-live="polite"
			>
				<span class="sr-only">{translate(lang, 'common.loading')}</span>
				{#each [0, 1, 2, 3] as i (i)}
					<li class="w-28 shrink-0 sm:w-32" aria-hidden="true">
						<div
							class="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]"
						>
							<div class="feed-skel aspect-square"></div>
							<div class="space-y-1.5 p-2">
								<div class="feed-skel h-3 w-4/5 rounded"></div>
								<div class="feed-skel h-2.5 w-3/5 rounded"></div>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<ul class="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] md:mx-0 md:px-0">
				{#each clips as clip (clip.id)}
					<li class="w-28 shrink-0 sm:w-32">
						<a
							href={`/exercise/${clip.exerciseId}?clip=${clip.id}`}
							class="group block overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] transition active:scale-[0.98] md:hover:border-[var(--color-accent)]"
						>
							<div class="relative aspect-square bg-[var(--color-surface-muted)]">
								{#if !loadedIds.has(clip.id)}
									<div class="feed-skel absolute inset-0" aria-hidden="true"></div>
								{/if}
								<img
									src={clip.gifUrl}
									alt={clip.title || translate(lang, 'clips.technique')}
									class={`relative h-full w-full object-contain transition-opacity duration-200 ${loadedIds.has(clip.id) ? 'opacity-100' : 'opacity-0'}`}
									loading="lazy"
									decoding="async"
									fetchpriority="low"
									onload={() => markLoaded(clip.id)}
								/>
							</div>
							<div class="space-y-0.5 p-2">
								<p class="truncate text-[11px] font-semibold leading-snug text-[var(--color-ink)]">
									{clip.title || translate(lang, 'clips.technique')}
								</p>
								<p class="truncate text-[10px] text-[var(--color-muted)]">
									{exerciseLabel(clip.exerciseId)}
								</p>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
