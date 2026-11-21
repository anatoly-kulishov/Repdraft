<script lang="ts">
	import { page } from '$app/stores';
	import Page from '../../../programs/[slug]/+page.svelte';
	import { enPath } from '$lib/seo/alternates';
	import { programPath } from '$lib/domain/programs';

	let slug = $derived($page.params.slug ?? '');
</script>

<Page localeOverride="en" pathOverride={enPath(programPath(slug))} />
