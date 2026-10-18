<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
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
</script>

<BottomSheet bind:open label={translate(lang, 'achievements.newUnlock')} onDismiss={() => (open = false)}>
	<div class="ach-unlock">
		<p class="ach-unlock__title">{translate(lang, 'achievements.newUnlock')}</p>
		<ul class="ach-unlock__list">
			{#each ids ?? [] as id (id)}
				<li>{translate(lang, achievementTitleKey(id))}</li>
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
		padding-left: 1.1rem;
		line-height: 1.5;
	}
</style>
