<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);

	const statLabels = $derived([
		{ title: translate(lang, 'home.statsThisWeek'), hint: translate(lang, 'home.statsWorkouts', { n: '—' }) },
		{ title: translate(lang, 'home.statsVolume'), hint: '—' },
		{
			title: translate(lang, 'home.statsStreak'),
			hint: translate(lang, 'home.statsDays', { n: '—' })
		}
	]);
</script>

<div class="home-stat-stack" aria-label={translate(lang, 'home.dashboardAsideAria')}>
	{#each statLabels as item (item.title)}
		<div class="home-stat-tile panel">
			<p class="home-stat-tile__label">{item.title}</p>
			<p class="home-stat-tile__value">{item.hint}</p>
		</div>
	{/each}
</div>
