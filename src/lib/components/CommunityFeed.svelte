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

	function clipSubtitle(clip: TechniqueClip): string | null {
		const title = clip.title?.trim();
		if (!title) return null;
		const generic = translate(lang, 'clips.technique');
		if (title === generic) return null;
		return title;
	}

	function markLoaded(id: string) {
		if (loadedIds.has(id)) return;
		loadedIds = new Set(loadedIds).add(id);
	}
</script>

{#if showShell && (showSkeletons || clips.length > 0 || failed)}
	<section class="mb-4 min-w-0" aria-labelledby="community-feed-heading">
		<div class="mb-3">
			<h2 id="community-feed-heading" class="section-title">
				{translate(lang, 'feed.title')}
			</h2>
			<p class="mt-1 text-sm text-[var(--color-muted)]">{translate(lang, 'feed.lead')}</p>
		</div>

		{#if failed && !showSkeletons}
			<p class="text-xs text-[var(--color-muted)]">{translate(lang, 'feed.fail')}</p>
		{:else if showSkeletons}
			<div class="feed-rail-wrap">
				<ul class="feed-rail" aria-busy="true" aria-live="polite">
					<span class="sr-only">{translate(lang, 'common.loading')}</span>
					{#each [0, 1, 2, 3] as i (i)}
						<li class="feed-card" aria-hidden="true">
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
			</div>
		{:else}
			<div class="feed-rail-wrap">
				<ul class="feed-rail" aria-label={translate(lang, 'feed.scroll')}>
					{#each clips as clip (clip.id)}
						{@const sub = clipSubtitle(clip)}
						<li class="feed-card">
							<a
								href={`/exercise/${clip.exerciseId}?clip=${clip.id}`}
								class="group block h-full overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] transition active:scale-[0.98] md:hover:border-[var(--color-accent)]"
							>
								<div class="relative aspect-square overflow-hidden bg-[var(--color-surface-muted)]">
									{#if !loadedIds.has(clip.id)}
										<div class="feed-skel absolute inset-0" aria-hidden="true"></div>
									{/if}
									<img
										src={clip.gifUrl}
										alt={exerciseLabel(clip.exerciseId)}
										class={`relative h-full w-full max-w-full object-cover transition-opacity duration-200 ${loadedIds.has(clip.id) ? 'opacity-100' : 'opacity-0'}`}
										loading="lazy"
										decoding="async"
										fetchpriority="low"
										onload={() => markLoaded(clip.id)}
									/>
								</div>
								<div class="space-y-0.5 p-2">
									<p class="line-clamp-2 min-h-[2.2em] text-[12px] font-semibold leading-snug text-[var(--color-ink)]">
										{exerciseLabel(clip.exerciseId)}
									</p>
									{#if sub}
										<p class="truncate text-[10px] text-[var(--color-muted)]">{sub}</p>
									{/if}
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>
{/if}
