<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import { ArrowLeft } from '@lucide/svelte';

	let {
		href,
		label,
		class: className = '',
		/** icon = compact crumb; link = arrow + label (profile hero, desktop crumbs). */
		variant = 'icon' as 'icon' | 'link'
	}: {
		href: string;
		label: string;
		class?: string;
		variant?: 'icon' | 'link';
	} = $props();

	const iconSize = $derived(variant === 'link' ? ICON_PRIMARY : ICON_SMALL);
</script>

<a class="subroute-back subroute-back--{variant} {className}" {href}>
	<LucideIcon icon={ArrowLeft} size={iconSize} />
	<span class="subroute-back__label">{label}</span>
</a>
