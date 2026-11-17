<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import {
		BorderBeam,
		ImageFx,
		LiquidGooey,
		MetalFx,
		ThinkingOrbs,
		type ThinkingOrbState
	} from '$lib/components/fx';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
	let gooeyActive = $state(0);
	let orbMode = $state<ThinkingOrbState>('working');

	const orbModes: ThinkingOrbState[] = [
		'working',
		'searching',
		'breathing',
		'composing',
		'connecting'
	];

	const gooeyLabels = ['A', 'B', 'C', 'D'] as const;
</script>

<SeoHead title="FX lab" noindex />

<div class="content-page content-page--narrow fx-lab">
	<ScreenHeader title="FX lab" backHref="/" />
	<p class="fx-lab__hint">
		{lang === 'ru'
			? 'Песочница эффектов (аналоги libraries.dev). Без деплоя на прод - смотри локально.'
			: 'Effects sandbox (libraries.dev cousins). Local preview - not a product surface.'}
	</p>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Border beam</h2>
		<p class="fx-lab__hint">Traveling glow on the card edge.</p>
		<BorderBeam class="rounded-[var(--radius-panel)] border border-[var(--color-border)] p-4">
			<p class="m-0 text-sm text-[var(--color-ink)]">
				{translate(lang, 'home.guestTrainKicker')}
			</p>
		</BorderBeam>
		<div class="fx-lab__row mt-3">
			<BorderBeam mode="pulse" class="rounded-xl border border-[var(--color-border)] px-3 py-2">
				<span class="text-sm">{lang === 'ru' ? 'Пульс' : 'Pulse'}</span>
			</BorderBeam>
		</div>
	</section>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Thinking orbs</h2>
		<p class="fx-lab__hint">AI busy indicator (canvas dots).</p>
		<div class="fx-lab__row">
			{#each orbModes as s (s)}
				<button
					type="button"
					class="btn-secondary min-h-[48px] min-w-[48px] px-3"
					class:is-active={orbMode === s}
					onclick={() => (orbMode = s)}
				>
					{s}
				</button>
			{/each}
		</div>
		<div class="fx-lab__row mt-3">
			<ThinkingOrbs mode={orbMode} size={64} label={orbMode} />
			<ThinkingOrbs mode={orbMode} size={20} label={orbMode} />
		</div>
	</section>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Liquid gooey</h2>
		<p class="fx-lab__hint">Soft pill that follows the active chip.</p>
		<LiquidGooey activeIndex={gooeyActive}>
			{#each gooeyLabels as label, i (label)}
				<button
					type="button"
					data-fx-gooey-item
					class="min-h-[48px] min-w-[48px] rounded-full border border-transparent px-4 text-sm font-semibold text-[var(--color-ink)]"
					onclick={() => (gooeyActive = i)}
				>
					{label}
				</button>
			{/each}
		</LiquidGooey>
	</section>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Liquid metal</h2>
		<p class="fx-lab__hint">Metallic ring around a primary CTA.</p>
		<MetalFx class="rounded-[var(--radius-button)]">
			<AppButton class="fx-cta-sheen min-w-[12rem]" block>
				{lang === 'ru' ? 'Пример CTA' : 'Sample CTA'}
			</AppButton>
		</MetalFx>
	</section>

	<section class="fx-lab__card">
		<h2 class="fx-lab__title">Image generation</h2>
		<p class="fx-lab__hint">Loader sheen that settles into the photo (no WebGL).</p>
		<div class="fx-lab__row">
			<ImageFx
				class="fx-lab__thumb"
				src="/brand-mark-pulse.png"
				alt="Repdraft"
				width={96}
				height={96}
			/>
			<ImageFx
				class="fx-lab__thumb"
				src="/icon-192-v3.png"
				alt=""
				width={96}
				height={96}
			/>
		</div>
	</section>
</div>
