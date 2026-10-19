<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import HeroFigure from '$lib/components/HeroFigure.svelte';
	import type { QuestHeroProfile, QuestHeroSex } from '$lib/domain/questHeroProfile';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		open = $bindable(false),
		defaultName = '',
		onComplete,
		onAbort
	}: {
		open?: boolean;
		defaultName?: string;
		onComplete: (profile: QuestHeroProfile) => void;
		onAbort?: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let name = $state('');
	let sex = $state<QuestHeroSex | null>(null);
	let age = $state('');
	let height = $state('');
	let weight = $state('');

	$effect(() => {
		if (open && name.length === 0 && defaultName) name = defaultName;
	});

	function parseHeight(): number | null {
		if (!height.trim()) return null;
		const n = parseInt(height, 10);
		if (!Number.isFinite(n)) return null;
		return Math.min(250, Math.max(100, n));
	}

	function parseWeight(): number | null {
		if (!weight.trim()) return null;
		const n = parseFloat(weight.replace(',', '.'));
		if (!Number.isFinite(n)) return null;
		return Math.min(300, Math.max(30, n));
	}

	let completing = false;

	let ready = $derived(
		name.trim().length > 0 && (sex === 'm' || sex === 'f') && parseHeight() != null && parseWeight() != null
	);

	function submit() {
		const heightCm = parseHeight();
		const weightKg = parseWeight();
		if (!name.trim() || (sex !== 'm' && sex !== 'f') || heightCm == null || weightKg == null) return;
		completing = true;
		onComplete({
			displayName: name.trim(),
			sex,
			age: age.trim() ? Math.min(99, Math.max(10, parseInt(age, 10) || 0)) : null,
			heightCm,
			weightKg,
			completedAt: new Date().toISOString()
		});
		open = false;
	}
</script>

<BottomSheet
	bind:open
	label={translate(lang, 'quest.onboardTitle')}
	onDismiss={() => {
		open = false;
		if (!completing) onAbort?.();
	}}
>
	<p class="quest-onboard__title">{translate(lang, 'quest.onboardTitle')}</p>
	<p class="quest-onboard__lead">{translate(lang, 'quest.onboardLead')}</p>
	<div class="quest-onboard__sex" role="group" aria-label={translate(lang, 'quest.onboardTitle')}>
		{#each ['m', 'f'] as const as s (s)}
			<button
				type="button"
				class="quest-onboard__sex-btn"
				class:quest-onboard__sex-btn--on={sex === s}
				aria-pressed={sex === s}
				aria-label={s === 'm' ? translate(lang, 'quest.sexM') : translate(lang, 'quest.sexF')}
				onclick={() => (sex = s)}
			>
				<HeroFigure {sex} size={72} />
				<span>{s === 'm' ? translate(lang, 'quest.sexM') : translate(lang, 'quest.sexF')}</span>
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
		<AppButton block disabled={!ready} onclick={submit}>{translate(lang, 'quest.onboardSubmit')}</AppButton>
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
		min-height: 48px;
		min-width: 48px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.35rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-border);
		background: transparent;
		color: inherit;
	}
	.quest-onboard__sex-btn--on {
		border-color: var(--color-muscle);
	}
	.quest-onboard__privacy {
		margin: 0.5rem 0 0;
		font-size: 0.8125rem;
		opacity: 0.7;
	}
</style>
