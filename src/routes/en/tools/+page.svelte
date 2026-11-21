<script lang="ts">
	import Page from '../../tools/+page.svelte';
	import { enPath } from '$lib/seo/alternates';
	import { TOOLS_HUB_PATH } from '$lib/domain/tools';
</script>

<Page localeOverride="en" pathOverride={enPath(TOOLS_HUB_PATH)} />
