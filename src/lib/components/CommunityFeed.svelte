<script lang="ts">
	import type { TechniqueClip } from '$lib/domain/clips';
	import { listRecentClips } from '$lib/storage/techniqueClipsRepository';
	import { translate } from '$lib/i18n/messages';
	import { isSupabaseConfigured } from '$lib/supabase/client';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		exerciseNames = new Map<string, string>()
	}: {
		exerciseNames?: Map<string, string>;
	} = $props();

	let clips = $state<TechniqueClip[]>([]);
	let loading = $state(true);
	let failed = $state(false);
	let lang = $derived($resolvedLocale);

	$effect(() => {
		if (!isSupabaseConfigured()) {
			loading = false;
			clips = [];
			return;
		}
		let cancelled = false;
		loading = true;
		failed = false;
		listRecentClips(16)
			.then((rows) => {
				if (!cancelled) {
					clips = rows;
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
</script>

{#if isSupabaseConfigured() && (loading || clips.length > 0 || failed)}
	<section class="mb-5" aria-labelledby="community-feed-heading">
		<div class="mb-2 flex items-baseline justify-between gap-2">
			<div>
				<h2 id="community-feed-heading" class="section-title text-lg">
					{translate(lang, 'feed.title')}
				</h2>
				<p class="text-xs text-[var(--color-muted)]">{translate(lang, 'feed.lead')}</p>
			</div>
		</div>

		{#if loading}
			<div class="flex gap-2.5 overflow-hidden">
				{#each [0, 1, 2, 3] as i (i)}
					<div class="h-36 w-28 shrink-0 animate-pulse rounded-xl bg-[var(--color-surface-muted)]"></div>
				{/each}
			</div>
		{:else if failed}
			<p class="text-xs text-[var(--color-muted)]">{translate(lang, 'feed.fail')}</p>
		{:else}
			<ul class="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] md:mx-0 md:px-0">
				{#each clips as clip (clip.id)}
					<li class="w-28 shrink-0 sm:w-32">
						<a
							href={`/exercise/${clip.exerciseId}?clip=${clip.id}`}
							class="group block overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] transition active:scale-[0.98] md:hover:border-[var(--color-accent)]"
						>
							<div class="aspect-square bg-black">
								<img
									src={clip.gifUrl}
									alt={clip.title || translate(lang, 'clips.technique')}
									class="h-full w-full object-contain"
									loading="lazy"
									decoding="async"
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
