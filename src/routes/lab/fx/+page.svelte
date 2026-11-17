<script lang="ts">
	import { Barbell, Plus, Timer, ListChecks } from 'phosphor-svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import {
		BOT_MOODS,
		BorderBeam,
		BotAvatar,
		GooeyMorph,
		ImageFx,
		LiquidGooey,
		MetalBadge,
		MetalFx,
		MetalText,
		THINKING_ORB_STATES,
		ThinkingOrbs,
		VoicePosition,
		WaveSwap,
		magnetic,
		type BotMood
	} from '$lib/components/fx';
	import SeoHead from '$lib/seo/SeoHead.svelte';

	type MorphItem = { id: 'set' | 'timer' | 'plan'; label: string };

	const beamSizes = ['md', 'sm', 'line', 'pulse-inner', 'pulse-outside'] as const;
	const gooeyLabels = ['Push', 'Pull', 'Legs', 'Core'] as const;
	const morphItems: MorphItem[] = [
		{ id: 'set', label: 'Add set' },
		{ id: 'timer', label: 'Rest timer' },
		{ id: 'plan', label: 'Plan' }
	];
	const panes = [
		{ title: 'Bench press', body: '4 x 8 @ 80 kg' },
		{ title: 'Pull-ups', body: '3 x 10, bodyweight' },
		{ title: 'Squat', body: '5 x 5 @ 100 kg' }
	];

	let gooeyActive = $state(0);
	let morphOpen = $state(false);
	let morphPicked = $state<string>('-');
	let pane = $state(0);
	let paneDir = $state<'forward' | 'back'>('forward');
	let botMood = $state<BotMood>('idle');
	let imageSeed = $state(1);
	let ctaDisabled = $state(false);

	const imageSrc = $derived(`/icon-512-v3.png?v=${imageSeed}`);

	function stepPane(delta: 1 | -1) {
		paneDir = delta > 0 ? 'forward' : 'back';
		pane = (pane + delta + panes.length) % panes.length;
	}
</script>

<SeoHead title="FX lab" noindex />

<div class="content-page content-page--narrow fx-lab">
	<ScreenHeader title="FX lab" backHref="/" />
	<p class="fx-lab__hint">Dev-only sandbox. Own Svelte/CSS takes on libraries.dev effects.</p>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Border beam</h2>
		<p class="fx-lab__hint">Rotate (md, sm, line) and pulse (inner, outside). Radius comes from the host.</p>
		<div class="fx-lab__grid">
			{#each beamSizes as size (size)}
				<div class="fx-lab__cell">
					<BorderBeam {size} class="fx-lab__tile w-full">{size}</BorderBeam>
				</div>
			{/each}
		</div>
	</section>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Thinking orbs</h2>
		<p class="fx-lab__hint">Nine states, 64 / 48 / 20 px. Canvas stops offscreen.</p>
		<div class="fx-lab__grid">
			{#each THINKING_ORB_STATES as state (state)}
				<div class="fx-lab__cell">
					<ThinkingOrbs mode={state} size={48} label={state} />
					<span>{state}</span>
				</div>
			{/each}
		</div>
		<div class="fx-lab__row mt-3">
			<ThinkingOrbs mode="working" size={64} label="working" />
			<ThinkingOrbs mode="working" size={20} label="working" />
		</div>
	</section>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Liquid gooey</h2>
		<p class="fx-lab__hint">Move: blob stretches to the active chip. Morph: trigger buds into actions.</p>
		<LiquidGooey activeIndex={gooeyActive}>
			{#each gooeyLabels as label, i (label)}
				<button
					type="button"
					data-fx-gooey-item
					class="min-h-[48px] min-w-[48px] rounded-full px-4 text-sm font-semibold"
					aria-pressed={gooeyActive === i}
					onclick={() => (gooeyActive = i)}
				>
					{label}
				</button>
			{/each}
		</LiquidGooey>
		<div
			class="fx-lab__row mt-4 justify-between"
			style="min-height: 240px; align-items: flex-end"
		>
			<span class="text-sm text-[var(--color-muted)]">Picked: {morphPicked}</span>
			<GooeyMorph
				items={morphItems}
				bind:open={morphOpen}
				triggerLabel="Actions"
				onSelect={(entry) => (morphPicked = entry.label)}
			>
				{#snippet trigger()}<Plus size={22} weight="bold" />{/snippet}
				{#snippet item(entry)}
					{#if entry.id === 'set'}
						<Barbell size={20} weight="bold" />
					{:else if entry.id === 'timer'}
						<Timer size={20} weight="bold" />
					{:else}
						<ListChecks size={20} weight="bold" />
					{/if}
				{/snippet}
			</GooeyMorph>
		</div>
	</section>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Liquid metal</h2>
		<p class="fx-lab__hint">Ring sits above the button and dims when disabled. Text and badge variants.</p>
		<div class="fx-lab__row">
			<MetalFx>
				<AppButton class="fx-cta-sheen min-w-[12rem]" disabled={ctaDisabled}>Start workout</AppButton>
			</MetalFx>
			<AppButton variant="secondary" onclick={() => (ctaDisabled = !ctaDisabled)}>
				{ctaDisabled ? 'Enable' : 'Disable'}
			</AppButton>
		</div>
		<div class="fx-lab__row mt-3">
			<MetalText tag="strong" class="text-2xl font-extrabold">Repdraft Pro</MetalText>
			<MetalBadge>Pro</MetalBadge>
		</div>
	</section>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Image generation</h2>
		<p class="fx-lab__hint">Shimmer while loading, then radial blur reveal. Reload restarts it.</p>
		<div class="fx-lab__row">
			<ImageFx class="fx-lab__thumb" src={imageSrc} alt="Repdraft icon" />
			<AppButton variant="secondary" onclick={() => (imageSeed += 1)}>Reload</AppButton>
		</div>
	</section>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Distortion waves</h2>
		<p class="fx-lab__hint">Pane swap through a moving wave front.</p>
		<WaveSwap key={pane} direction={paneDir}>
			<div class="fx-lab__wave-pane bg-[var(--color-surface-muted)]">
				<p class="m-0 text-base font-bold">{panes[pane].title}</p>
				<p class="m-0 mt-1 text-sm text-[var(--color-muted)]">{panes[pane].body}</p>
			</div>
		</WaveSwap>
		<div class="fx-lab__row mt-3">
			<AppButton variant="secondary" onclick={() => stepPane(-1)}>Back</AppButton>
			<AppButton variant="secondary" onclick={() => stepPane(1)}>Next</AppButton>
		</div>
	</section>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Magnetic UI</h2>
		<p class="fx-lab__hint">Mouse / trackpad only. Touch and reduced motion stay still.</p>
		<div class="fx-lab__row justify-center py-4">
			<div {@attach magnetic()}>
				<AppButton>
					<span data-magnetic-inner>Pull me</span>
				</AppButton>
			</div>
			<div {@attach magnetic({ strength: 0.5, radius: 40 })}>
				<AppButton variant="secondary">Strong</AppButton>
			</div>
		</div>
	</section>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Voice position</h2>
		<p class="fx-lab__hint">Drag the source around the listener. Pan, distance, muffle behind. Use headphones.</p>
		<VoicePosition playLabel="Play" stopLabel="Stop" sourceLabel="Voice source" />
	</section>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Bot avatars</h2>
		<p class="fx-lab__hint">Moods, blink, pupils follow the pointer.</p>
		<div class="fx-lab__row">
			<BotAvatar mood={botMood} size={72} label={`Bot, ${botMood}`} />
			<BotAvatar mood={botMood} size={40} label={`Bot, ${botMood}`} />
		</div>
		<div class="fx-lab__row mt-3">
			{#each BOT_MOODS as mood (mood)}
				<AppButton
					variant={mood === botMood ? 'primary' : 'secondary'}
					onclick={() => (botMood = mood)}
				>
					{mood}
				</AppButton>
			{/each}
		</div>
	</section>
</div>
