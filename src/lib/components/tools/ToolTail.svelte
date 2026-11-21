<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import { TOOL_IDS, toolPath, type ToolId } from '$lib/domain/tools';
	import { enPath } from '$lib/seo/alternates';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		howTitle,
		howPoints,
		note,
		current,
		enMirror = false
	}: {
		howTitle: string;
		howPoints: string[];
		note: string;
		current: ToolId;
		/** `/en/tools/*` mirror: keep the "other tools" links inside the mirror. */
		enMirror?: boolean;
	} = $props();

	const LABEL_KEYS: Record<ToolId, string> = {
		'one-rep-max': 'tools.hub.ormTitle',
		calories: 'tools.hub.caloriesTitle',
		bmi: 'tools.hub.bmiTitle',
		'heart-rate-zones': 'tools.hub.hrTitle'
	};

	let lang = $derived($resolvedLocale);
	let otherTools = $derived(TOOL_IDS.filter((id) => id !== current));
</script>

<section class="panel tool-panel">
	<h2 class="tool-section-title">{howTitle}</h2>
	<ul class="tool-list">
		{#each howPoints as point (point)}
			<li>{point}</li>
		{/each}
	</ul>
</section>

<AppButton href="/builder" block>{translate(lang, 'tools.ctaBuilder')}</AppButton>

<p class="tool-note">{note}</p>

<nav class="tool-more" aria-label={translate(lang, 'tools.moreTools')}>
	{#each otherTools as id (id)}
		<a class="tool-more__link" href={enMirror ? enPath(toolPath(id)) : toolPath(id)}>{translate(lang, LABEL_KEYS[id])}</a>
	{/each}
	<a class="tool-more__link" href="/exercises">{translate(lang, 'nav.catalog')}</a>
</nav>
