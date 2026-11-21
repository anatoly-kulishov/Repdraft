<script lang="ts">
	import Page from '../../../tools/bmi/+page.svelte';
	import { enPath } from '$lib/seo/alternates';
	import { toolPath } from '$lib/domain/tools';
</script>

<Page localeOverride="en" pathOverride={enPath(toolPath('bmi'))} />
