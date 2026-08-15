<script lang="ts">
	import {
		catalogZonePath,
		hubCatalogZones,
		labelCatalogZone,
		type CatalogZoneSlug
	} from '$lib/domain/catalogLinks';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { page } from '$app/stores';

	let {
		bodyParts,
		activeZone = 'all',
		equipment = 'all',
		target = 'all',
		query = ''
	}: {
		bodyParts: string[];
		/** Current catalog zone slug (`all` or hub zone). */
		activeZone?: string;
		equipment?: string;
		target?: string;
		query?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
	let zones = $derived(hubCatalogZones(bodyParts));

	function chipHref(zone: CatalogZoneSlug | 'all'): string {
		const path = catalogZonePath(zone, {
			equipment: equipment !== 'all' ? equipment : undefined,
			target: target !== 'all' ? target : undefined,
			q: query.trim() || undefined
		});
		const from = $page.url.searchParams.get('from');
		if (!from) return path;
		const sep = path.includes('?') ? '&' : '?';
		return `${path}${sep}from=${encodeURIComponent(from)}`;
	}
</script>

<nav class="catalog-zone-chips" aria-label={translate(lang, 'catalog.zonesAria')}>
	<a
		class="catalog-zone-chip"
		class:is-active={activeZone === 'all'}
		href={chipHref('all')}
		aria-current={activeZone === 'all' ? 'page' : undefined}
	>
		{translate(lang, 'catalog.all')}
	</a>
	{#each zones as zone (zone)}
		<a
			class="catalog-zone-chip"
			class:is-active={activeZone === zone}
			href={chipHref(zone)}
			aria-current={activeZone === zone ? 'page' : undefined}
		>
			{labelCatalogZone(zone, lang)}
		</a>
	{/each}
</nav>
