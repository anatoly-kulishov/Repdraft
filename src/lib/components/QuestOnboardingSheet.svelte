<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import HeroFigure from '$lib/components/HeroFigure.svelte';
	import {
		isQuestOnboardingReady,
		parseOnboardHeightCm,
		parseOnboardWeightKg,
		type QuestHeroProfile,
		type QuestHeroSex
	} from '$lib/domain/questHeroProfile';
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
	let wasOpen = $state(false);
	/** Programmatic close after submit must not fire onAbort (race with sheet onOpenChange). */
	let skipAbortOnce = $state(false);

	$effect(() => {
		if (open && !wasOpen) {
			name = defaultName.trim() || '';
			sex = null;
			age = '';
			height = '';
			weight = '';
			skipAbortOnce = false;
		}
		wasOpen = open;
	});

	let ready = $derived(
		isQuestOnboardingReady({ displayName: name, sex, heightRaw: height, weightRaw: weight })
	);

	function submit(event?: Event) {
		event?.preventDefault();
		const heightCm = parseOnboardHeightCm(height);
		const weightKg = parseOnboardWeightKg(weight);
		if (!name.trim() || (sex !== 'm' && sex !== 'f') || heightCm == null || weightKg == null) return;
		const profile: QuestHeroProfile = {
			displayName: name.trim(),
			sex,
			age: age.trim() ? Math.min(99, Math.max(10, parseInt(String(age), 10) || 0)) : null,
			heightCm,
			weightKg,
			completedAt: new Date().toISOString()
		};
		skipAbortOnce = true;
		onComplete(profile);
		open = false;
	}
</script>

<BottomSheet
	bind:open
	label={translate(lang, 'quest.onboardTitle')}
	onDismiss={() => {
		open = false;
		if (skipAbortOnce) {
			skipAbortOnce = false;
			return;
		}
		onAbort?.();
	}}
>
	<p class="quest-onboard__title">{translate(lang, 'quest.onboardTitle')}</p>
	<p class="quest-onboard__lead">{translate(lang, 'quest.onboardLead')}</p>
	<form class="quest-onboard__form" onsubmit={submit}>
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
					{#key s}
						<HeroFigure sex={s} size={72} />
					{/key}
					<span>{s === 'm' ? translate(lang, 'quest.sexM') : translate(lang, 'quest.sexF')}</span>
				</button>
			{/each}
		</div>
		<AppInput
			type="text"
			placeholder={translate(lang, 'quest.onboardName')}
			bind:value={name}
		/>
		<AppInput
			type="text"
			inputmode="numeric"
			autocomplete="off"
			placeholder={translate(lang, 'quest.onboardAge')}
			bind:value={age}
		/>
		<AppInput
			type="text"
			inputmode="numeric"
			autocomplete="off"
			placeholder={translate(lang, 'quest.onboardHeight')}
			bind:value={height}
		/>
		<AppInput
			type="text"
			inputmode="decimal"
			autocomplete="off"
			placeholder={translate(lang, 'quest.onboardWeight')}
			bind:value={weight}
		/>
		<p class="quest-onboard__privacy">{translate(lang, 'quest.onboardPrivacy')}</p>
		<AppButton type="submit" block disabled={!ready}>
			{translate(lang, 'quest.onboardSubmit')}
		</AppButton>
	</form>
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
	.quest-onboard__form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
	}
	.quest-onboard__form > .quest-onboard__privacy {
		margin-top: 0.15rem;
	}
	.quest-onboard__privacy {
		margin: 0.5rem 0 1.25rem;
		font-size: 0.8125rem;
		line-height: 1.45;
		opacity: 0.7;
	}
</style>
