<script lang="ts">
	import AchievementsPanel from '$lib/components/AchievementsPanel.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { countableFinishedSessions } from '$lib/domain/achievements';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { achievementsState } from '$lib/stores/achievements';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
	let finished = $derived(countableFinishedSessions($live.history));
</script>

<SeoHead title={translate(lang, 'achievements.title')} noindex />

<section class="content-page content-page--narrow pb-mobile-actions">
	<ScreenHeader
		title={translate(lang, 'achievements.title')}
		backHref="/auth"
		backLabelVisible
		preferHistoryBack
	/>
	<AppPanel class="text-left">
		<AchievementsPanel state={$achievementsState} finishedSessions={finished} showFilters />
	</AppPanel>
</section>
