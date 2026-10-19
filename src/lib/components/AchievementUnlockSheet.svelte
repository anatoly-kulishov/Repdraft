<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import HeroFigure from '$lib/components/HeroFigure.svelte';
	import type { QuestHeroProfile } from '$lib/domain/questHeroProfile';
	import { loadQuestHeroProfile } from '$lib/stores/questHero';
	import { onMount } from 'svelte';
	import AchievementGlyph from '$lib/components/AchievementGlyph.svelte';
	import { achievementTitleKey, type AchievementId } from '$lib/domain/achievements';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		open = $bindable(false),
		ids,
		onViewAll
	}: {
		open?: boolean;
		ids: AchievementId[] | null;
		onViewAll?: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let profile = $state<QuestHeroProfile | null>(null);

	onMount(() => {
		profile = loadQuestHeroProfile();
	});
</script>

<BottomSheet bind:open label={translate(lang, 'achievements.newUnlock')} onDismiss={() => (open = false)}>
	<div class="ach-unlock">
		<HeroFigure sex={profile?.sex ?? null} size={72} />
		<p class="ach-unlock__title">{translate(lang, 'achievements.newUnlock')}</p>
		<ul class="ach-unlock__list">
			{#each ids ?? [] as id (id)}
				<li>
					<AchievementGlyph {id} />
					<span>{translate(lang, achievementTitleKey(id))}</span>
				</li>
			{/each}
		</ul>
	</div>
	{#snippet actions()}
		<AppButton
			block
			onclick={() => {
				open = false;
				onViewAll?.();
			}}
		>
			{translate(lang, 'achievements.viewAll')}
		</AppButton>
	{/snippet}
</BottomSheet>

<style>
	.ach-unlock__title {
		margin: 0 0 0.75rem;
		font-size: 1.125rem;
		font-weight: 800;
	}
	.ach-unlock__list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.ach-unlock__list li {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		font-weight: 650;
		line-height: 1.3;
	}
</style>
