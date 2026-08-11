<script lang="ts">
	import { catalogZonePath } from '$lib/domain/catalogLinks';
	import type { TargetChip } from '$lib/domain/filters';
	import { labelTarget } from '$lib/domain/labels.ru';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		bodyPart,
		chips,
		zoneCount,
		activeTarget = '',
		equipment = '',
		query = ''
	}: {
		bodyPart: string;
		chips: TargetChip[];
		zoneCount: number;
		activeTarget?: string;
		equipment?: string;
		query?: string;
	} = $props();

	let lang = $derived($resolvedLocale);

	function chipHref(target?: string) {
		return catalogZonePath(bodyPart, {
			target: target && target !== 'all' ? target : undefined,
			equipment: equipment || undefined,
			q: query.trim() || undefined
		});
	}
</script>

{#if chips.length >= 2}
	<nav class="catalog-target-chips" aria-label={translate(lang, 'catalog.targetChipsAria')}>
		<a
			href={chipHref()}
			class="catalog-target-chip"
			class:is-active={!activeTarget}
			aria-current={!activeTarget ? 'page' : undefined}
		>
			<span class="catalog-target-chip__label">{translate(lang, 'catalog.all')}</span>
			<span class="catalog-target-chip__count" aria-hidden="true">{zoneCount}</span>
		</a>
		{#each chips as chip (chip.target)}
			<a
				href={chipHref(chip.target)}
				class="catalog-target-chip"
				class:is-active={activeTarget === chip.target}
				aria-current={activeTarget === chip.target ? 'page' : undefined}
			>
				<span class="catalog-target-chip__label">{labelTarget(chip.target, lang)}</span>
				<span class="catalog-target-chip__count" aria-hidden="true">{chip.count}</span>
			</a>
		{/each}
	</nav>
{/if}
