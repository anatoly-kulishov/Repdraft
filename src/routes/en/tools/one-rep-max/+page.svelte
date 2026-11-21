<script lang="ts">
	import Page from '../../../tools/one-rep-max/+page.svelte';
	import { enPath } from '$lib/seo/alternates';
	import { toolPath } from '$lib/domain/tools';
</script>

<Page localeOverride="en" pathOverride={enPath(toolPath('one-rep-max'))} />
