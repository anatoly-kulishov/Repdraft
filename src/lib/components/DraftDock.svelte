<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import Coachmark from '$lib/components/onboarding/Coachmark.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { draft, draftHydrated } from '$lib/stores/draft';
	import { onboarding } from '$lib/stores/onboarding';
	import { shouldShowCoachmark } from '$lib/domain/onboarding';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ClipboardList } from '@lucide/svelte';
	import { page } from '$app/stores';

	let lang = $derived($resolvedLocale);
	let count = $derived($draft.exercises.length);
	let path = $derived($page.url.pathname);

	let hideOnRoute = $derived(
		path.startsWith('/builder') ||
			path.startsWith('/exercise/') ||
			path.startsWith('/live/') ||
			path.startsWith('/auth') ||
			path === '/privacy' ||
			path === '/workouts/summary' ||
			/^\/workouts\/[^/]+$/.test(path)
	);

	let visible = $derived($draftHydrated && count > 0 && !hideOnRoute);
	let showHint = $derived(visible && shouldShowCoachmark($onboarding, 'draft.dock'));
</script>

{#if visible}
	<div class="draft-dock-wrap">
		{#if showHint}
			<Coachmark
				class="draft-dock-wrap__hint"
				message={translate(lang, 'onboarding.draftDockHint')}
				onDismiss={() => onboarding.dismissCoachmark('draft.dock')}
			/>
		{/if}
		<AppButton class="draft-dock" href="/builder" aria-label={translate(lang, 'draft.dock', { n: count })}>
			<LucideIcon icon={ClipboardList} size={ICON_BUTTON} />
			<span class="draft-dock__label">{translate(lang, 'draft.dock', { n: count })}</span>
			<span class="draft-dock__count">{count}</span>
		</AppButton>
	</div>
{/if}
