<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { records, recordsReady } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { BookOpen, Bookmark, List, Trophy } from '@lucide/svelte';

	let {
		class: className = ''
	}: {
		class?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
	let recordCount = $derived($records.length);
</script>

<nav class="catalog-hub-chips {className}" aria-label={translate(lang, 'catalog.hubNavAria')}>
	<a class="catalog-hub-chip catalog-hub-chip--primary" href="/catalog/all">
		<LucideIcon icon={List} size={ICON_BUTTON} />
		<span>{translate(lang, 'catalog.browseAll')}</span>
	</a>
	<a class="catalog-hub-chip" href="/exercises/saved">
		<LucideIcon icon={Bookmark} size={ICON_BUTTON} />
		<span>{translate(lang, 'bookmarks.title')}</span>
	</a>
	<a class="catalog-hub-chip" href="/articles">
		<LucideIcon icon={BookOpen} size={ICON_BUTTON} />
		<span>{translate(lang, 'articles.title')}</span>
	</a>
	<a class="catalog-hub-chip" href="/records">
		<LucideIcon icon={Trophy} size={ICON_BUTTON} />
		<span>{translate(lang, 'records.title')}</span>
		{#if $recordsReady && recordCount > 0}
			<span class="catalog-hub-nav-count">{recordCount}</span>
		{/if}
	</a>
</nav>
