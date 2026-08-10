<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { formatPersonalRecord } from '$lib/domain/records';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { records, recordsReady } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ChevronRight } from '@lucide/svelte';

	let {
		indexById,
		limit = 3
	}: {
		indexById: Map<string, ExerciseIndexItem>;
		limit?: number;
	} = $props();

	let lang = $derived($resolvedLocale);
	let preview = $derived($records.slice(0, limit));
	let ready = $derived($recordsReady);
	let hasRecords = $derived(preview.length > 0);

	function titleFor(exerciseId: string): string {
		const meta = indexById.get(exerciseId);
		return meta
			? exerciseName(meta, lang)
			: translate(lang, 'records.fallback', { id: exerciseId });
	}
</script>

<div class="home-section home-section--records">
	<div class="home-section-head">
		<h2 class="section-title">{translate(lang, 'home.recordsTitle')}</h2>
		{#if ready && hasRecords}
			<a class="home-section-link" href="/records">
				{translate(lang, 'home.recordsAll')}
				<LucideIcon icon={ChevronRight} size={ICON_SMALL} />
			</a>
		{/if}
	</div>

	{#if !ready}
		<div class="panel records-preview" aria-busy="true">
			<div class="records-preview__skeleton animate-pulse" aria-hidden="true"></div>
			<div class="records-preview__skeleton animate-pulse" aria-hidden="true"></div>
		</div>
	{:else if hasRecords}
		<ul class="records-preview panel">
			{#each preview as record (record.exerciseId)}
				{@const meta = indexById.get(record.exerciseId)}
				<li>
					<a class="records-preview__row" href={`/exercise/${record.exerciseId}`}>
						{#if meta}
							<img
								class="records-preview__thumb"
								src={`/${meta.image}`}
								alt=""
								width="40"
								height="40"
								loading="lazy"
								decoding="async"
							/>
						{:else}
							<span class="records-preview__thumb records-preview__thumb--empty" aria-hidden="true"
							></span>
						{/if}
						<span class="records-preview__text">
							<span class="records-preview__name">{titleFor(record.exerciseId)}</span>
							<span class="records-preview__value">{formatPersonalRecord(record, lang)}</span>
						</span>
						<span class="records-preview__chevron" aria-hidden="true">
							<LucideIcon icon={ChevronRight} size={ICON_SMALL} />
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="panel-dashed home-mid-placeholder">
			<p class="home-mid-placeholder__text">{translate(lang, 'home.recordsHint')}</p>
			<a class="home-section-link mt-2" href="/exercises">
				{translate(lang, 'home.recordsBrowse')}
				<LucideIcon icon={ChevronRight} size={ICON_SMALL} />
			</a>
		</div>
	{/if}
</div>
