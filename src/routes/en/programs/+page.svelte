<script lang="ts">
	import Page from '../../programs/+page.svelte';
	import { enPath } from '$lib/seo/alternates';
	import { PROGRAMS_HUB_PATH } from '$lib/domain/programs';
</script>

<Page localeOverride="en" pathOverride={enPath(PROGRAMS_HUB_PATH)} />
