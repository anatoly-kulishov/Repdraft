<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import type { QuestHeroProfile, QuestHeroSex } from '$lib/domain/questHeroProfile';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		open = $bindable(false),
		defaultName = '',
		onComplete,
		onSkip
	}: {
		open?: boolean;
		defaultName?: string;
		onComplete: (profile: QuestHeroProfile) => void;
		onSkip: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let name = $state('');
	let sex = $state<QuestHeroSex | null>(null);
	let age = $state('');
	let height = $state('');
	let weight = $state('');

	$effect(() => {
		if (open && !name && defaultName) name = defaultName;
	});

	function submit() {
		onComplete({
			displayName: name.trim(),
			sex,
			age: age.trim() ? Math.min(99, Math.max(10, parseInt(age, 10) || 0)) : null,
			heightCm: height.trim()
				? Math.min(250, Math.max(100, parseInt(height, 10) || 0))
				: null,
			weightKg: weight.trim()
				? Math.min(300, Math.max(30, parseFloat(weight.replace(',', '.')) || 0))
				: null,
			completedAt: new Date().toISOString()
		});
		open = false;
	}

	function skip() {
		onSkip();
		open = false;
	}
</script>

<BottomSheet bind:open label={translate(lang, 'quest.onboardTitle')} onDismiss={skip}>
	<p class="quest-onboard__title">{translate(lang, 'quest.onboardTitle')}</p>
	<p class="quest-onboard__lead">{translate(lang, 'quest.onboardLead')}</p>
	<div class="quest-onboard__sex" role="group" aria-label={translate(lang, 'quest.onboardTitle')}>
		{#each ['m', 'f'] as const as s (s)}
			<button
				type="button"
				class="quest-onboard__sex-btn"
				class:quest-onboard__sex-btn--on={sex === s}
				onclick={() => (sex = s)}
			>
				{s === 'm' ? translate(lang, 'quest.sexM') : translate(lang, 'quest.sexF')}
			</button>
		{/each}
	</div>
	<AppInput
		class="quest-onboard__field"
		type="text"
		placeholder={translate(lang, 'quest.onboardName')}
		bind:value={name}
	/>
	<AppInput
		class="quest-onboard__field"
		type="number"
		inputmode="numeric"
		placeholder={translate(lang, 'quest.onboardAge')}
		bind:value={age}
	/>
	<AppInput
		class="quest-onboard__field"
		type="number"
		inputmode="numeric"
		placeholder={translate(lang, 'quest.onboardHeight')}
		bind:value={height}
	/>
	<AppInput
		class="quest-onboard__field"
		type="text"
		inputmode="decimal"
		placeholder={translate(lang, 'quest.onboardWeight')}
		bind:value={weight}
	/>
	<p class="quest-onboard__privacy">{translate(lang, 'quest.onboardPrivacy')}</p>
	{#snippet actions()}
		<AppButton block onclick={submit}>{translate(lang, 'quest.onboardSubmit')}</AppButton>
		<AppButton block variant="ghost" onclick={skip}>{translate(lang, 'quest.onboardSkip')}</AppButton>
	{/snippet}
</BottomSheet>

<style>
	.quest-onboard__title {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 800;
	}
	.quest-onboard__lead {
		margin: 0.35rem 0 0.75rem;
		font-size: 0.875rem;
		opacity: 0.8;
		line-height: 1.4;
	}
	.quest-onboard__sex {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.65rem;
	}
	.quest-onboard__sex-btn {
		flex: 1;
		min-height: 3rem;
		border-radius: var(--radius-md, 10px);
		border: 1px solid var(--color-border);
		font-weight: 700;
	}
	.quest-onboard__sex-btn--on {
		border-color: var(--color-accent);
		background: color-mix(in srgb, var(--color-accent) 12%, transparent);
	}
	.quest-onboard__field {
		margin-bottom: 0.5rem;
	}
	.quest-onboard__privacy {
		margin: 0.5rem 0 0;
		font-size: 0.8125rem;
		opacity: 0.75;
		line-height: 1.35;
	}
</style>
