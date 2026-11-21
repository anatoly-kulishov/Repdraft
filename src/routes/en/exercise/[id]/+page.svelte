<script lang="ts">
	import { page } from '$app/stores';
	import Page from '../../../exercise/[id]/+page.svelte';
	import { enPath } from '$lib/seo/alternates';

	let { data } = $props();
	let id = $derived($page.params.id ?? '');
</script>

<Page
	{data}
	localeOverride="en"
	pathOverride={id ? enPath(`/exercise/${encodeURIComponent(id)}`) : null}
/>
