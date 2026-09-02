<script lang="ts">
	import AppBadge from '$lib/components/AppBadge.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { withFromParam } from '$lib/domain/catalogLinks';
	import { hasLiftData } from '$lib/domain/records';
	import { translate } from '$lib/i18n/messages';
	import { records, recordsReady } from '$lib/stores/records';
	import { resolvedLocale } from '$lib/stores/locale';
	import { BookOpen, Bookmark, List, Trophy } from '@lucide/svelte';

	let {
		class: className = '',
		from = null as string | null,
		/** Builder pick-flow: only browse-all + saved — skip records/articles detours. */
		pickMode = false
	}: {
		class?: string;
		from?: string | null;
		pickMode?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let recordCount = $derived($records.filter(hasLiftData).length);
	let browseAllHref = $derived(withFromParam('/catalog/all', from));
	let savedHref = $derived(withFromParam('/exercises/saved', from));
</script>

<nav class="catalog-hub-chips {className}" aria-label={translate(lang, 'catalog.hubNavAria')}>
	<AppBadge href={browseAllHref} variant="outline" class="catalog-hub-chip">
		<LucideIcon icon={List} size={ICON_BUTTON} />
		<span>{translate(lang, 'catalog.browseAll')}</span>
	</AppBadge>
	<AppBadge href={savedHref} variant="outline" class="catalog-hub-chip">
		<LucideIcon icon={Bookmark} size={ICON_BUTTON} />
		<span>{translate(lang, 'bookmarks.title')}</span>
	</AppBadge>
	{#if !pickMode}
		<AppBadge href={withFromParam('/exercises/records', from)} variant="outline" class="catalog-hub-chip">
			<LucideIcon icon={Trophy} size={ICON_BUTTON} />
			<span>{translate(lang, 'records.title')}</span>
			{#if $recordsReady && recordCount > 0}
				<span class="catalog-hub-nav-count">{recordCount}</span>
			{/if}
		</AppBadge>
		<AppBadge href={withFromParam('/articles', from)} variant="outline" class="catalog-hub-chip">
			<LucideIcon icon={BookOpen} size={ICON_BUTTON} />
			<span>{translate(lang, 'articles.title')}</span>
		</AppBadge>
	{/if}
</nav>
