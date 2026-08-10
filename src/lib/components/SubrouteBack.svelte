<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { ArrowLeft } from '@lucide/svelte';

	let {
		href,
		label,
		class: className = ''
	}: {
		href: string;
		label: string;
		class?: string;
	} = $props();
</script>

<a class="subroute-back {className}" {href}>
	<LucideIcon icon={ArrowLeft} size={ICON_SMALL} />
	{label}
</a>
