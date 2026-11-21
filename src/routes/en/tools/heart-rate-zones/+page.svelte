<script lang="ts">
	import Page from '../../../tools/heart-rate-zones/+page.svelte';
	import { enPath } from '$lib/seo/alternates';
	import { toolPath } from '$lib/domain/tools';
</script>

<Page localeOverride="en" pathOverride={enPath(toolPath('heart-rate-zones'))} />
