<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { withFromParam } from '$lib/domain/catalogLinks';
	import { translate } from '$lib/i18n/messages';
	import { records, recordsReady } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { BookOpen, Bookmark, List, Trophy } from '@lucide/svelte';

	let {
		class: className = '',
		from = null as string | null
	}: {
		class?: string;
		from?: string | null;
	} = $props();

	let lang = $derived($resolvedLocale);
	let recordCount = $derived($records.length);
	let browseAllHref = $derived(withFromParam('/catalog/all', from));
	let savedHref = $derived(withFromParam('/exercises/saved', from));
</script>

<nav class="catalog-hub-chips {className}" aria-label={translate(lang, 'catalog.hubNavAria')}>
	<a class="catalog-hub-chip catalog-hub-chip--primary" href={browseAllHref}>
		<LucideIcon icon={List} size={ICON_BUTTON} />
		<span>{translate(lang, 'catalog.browseAll')}</span>
	</a>
	<a class="catalog-hub-chip" href={savedHref}>
		<LucideIcon icon={Bookmark} size={ICON_BUTTON} />
		<span>{translate(lang, 'bookmarks.title')}</span>
	</a>
	<a class="catalog-hub-chip" href="/records">
		<LucideIcon icon={Trophy} size={ICON_BUTTON} />
		<span>{translate(lang, 'records.title')}</span>
		{#if $recordsReady && recordCount > 0}
			<span class="catalog-hub-nav-count">{recordCount}</span>
		{/if}
	</a>
	<a class="catalog-hub-chip" href="/articles">
		<LucideIcon icon={BookOpen} size={ICON_BUTTON} />
		<span>{translate(lang, 'articles.title')}</span>
	</a>
</nav>
