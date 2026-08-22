<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let { class: className = '' }: { class?: string } = $props();

	let lang = $derived($resolvedLocale);
</script>

<p class="brand-tagline {className}">
	{translate(lang, 'brand.tagline')}
</p>
