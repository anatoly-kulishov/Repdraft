<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { draft, draftHydrated } from '$lib/stores/draft';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ClipboardList } from '@lucide/svelte';
	import { page } from '$app/stores';

	let lang = $derived($resolvedLocale);
	let count = $derived($draft.exercises.length);
	let path = $derived($page.url.pathname);

	let hasOwnStickyCta = $derived(
		path.startsWith('/builder') ||
			path.startsWith('/exercise/') ||
			path.startsWith('/live/') ||
			path === '/workouts/summary' ||
			/^\/workouts\/[^/]+$/.test(path)
	);

	let visible = $derived($draftHydrated && count > 0 && !hasOwnStickyCta);
</script>

{#if visible}
	<AppButton class="draft-dock" href="/builder" aria-label={translate(lang, 'draft.dock', { n: count })}>
		<LucideIcon icon={ClipboardList} size={ICON_BUTTON} />
		<span class="draft-dock__label">{translate(lang, 'draft.dock', { n: count })}</span>
		<span class="draft-dock__count">{count}</span>
	</AppButton>
{/if}
