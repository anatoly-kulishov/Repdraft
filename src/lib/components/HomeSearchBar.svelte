<script lang="ts">
	import IconPlate from '$lib/components/IconPlate.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Search } from '@lucide/svelte';

	let lang = $derived($resolvedLocale);
</script>

<a class="home-search-bar" href="/exercises">
	<IconPlate icon={Search} tone="accent" class="home-search-bar__mark" />
	<span class="home-search-bar__placeholder">{translate(lang, 'home.searchPh')}</span>
</a>
