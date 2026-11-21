<script lang="ts">
	import '$lib/styles/blocks/builder-pick.css';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppChip from '$lib/components/AppChip.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ExerciseCard from '$lib/components/ExerciseCard.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { loadExerciseIndexWithCustoms } from '$lib/data/exerciseIndexWithCustoms';
	import { peekExerciseIndex } from '$lib/data/loadExercises';
	import { catalogZoneBodyParts, hubCatalogZones, labelCatalogZone } from '$lib/domain/catalogLinks';
	import {
		equipmentFacets,
		exerciseMatchesEquipment,
		pickExercisesForKit
	} from '$lib/domain/exercisePick';
	import { labelEquipment } from '$lib/domain/labels.ru';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ArrowLeft, ArrowRight, Check, SlidersHorizontal } from 'phosphor-svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';

	const STEP_KEYS = [
		'builder.pickStepEquipment',
		'builder.pickStepMuscles',
		'builder.pickStepExercises'
	] as const;
	const EQUIPMENT_PREVIEW = 9;
	/** Enough to recognise the staples without an endless scroll inside a step. */
	const PICK_LIMIT = 24;

	let lang = $derived($resolvedLocale);
	let catalog = $state<ExerciseIndexItem[]>([]);
	let loading = $state(true);
	let step = $state(1);
	let equipment = $state<string[]>([]);
	let zones = $state<string[]>([]);
	let showAllEquipment = $state(false);

	let allFacets = $derived(equipmentFacets(catalog, 99));
	let visibleFacets = $derived(
		showAllEquipment ? allFacets : allFacets.slice(0, EQUIPMENT_PREVIEW)
	);
	let zoneList = $derived(hubCatalogZones([...new Set(catalog.map((item) => item.body_part))]));
	let zoneCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const zone of zoneList) {
			const parts = new Set(catalogZoneBodyParts(zone));
			counts.set(
				zone,
				catalog.filter(
					(item) => parts.has(item.body_part) && exerciseMatchesEquipment(item, equipment)
				).length
			);
		}
		return counts;
	});
	let bodyPartFilters = $derived(zones.flatMap((zone) => catalogZoneBodyParts(zone)));
	let matches = $derived(
		pickExercisesForKit(catalog, { equipment, bodyParts: bodyPartFilters })
	);
	let shown = $derived(matches.slice(0, PICK_LIMIT));
	let progressPct = $derived(Math.round((step / STEP_KEYS.length) * 100));

	onMount(() => {
		// Warm nav: the catalog is already cached, paint the first step at once.
		const cached = peekExerciseIndex();
		if (cached) {
			catalog = cached;
			loading = false;
		}
		void loadExerciseIndexWithCustoms()
			.then((rows) => {
				catalog = rows;
			})
			.catch(() => {
				/* The page still works with the cached index or an honest empty state. */
			})
			.finally(() => {
				loading = false;
			});
	});

	function toggleEquipment(value: string) {
		equipment = equipment.includes(value)
			? equipment.filter((item) => item !== value)
			: [...equipment, value];
	}

	function toggleZone(zone: string) {
		zones = zones.includes(zone) ? zones.filter((item) => item !== zone) : [...zones, zone];
	}

	function resetFilters() {
		equipment = [];
		zones = [];
		step = 1;
	}

	function next() {
		if (step < STEP_KEYS.length) {
			step += 1;
			return;
		}
		void goto('/builder');
	}

	function back() {
		if (step > 1) {
			step -= 1;
			return;
		}
		void goto('/builder');
	}

	function equipmentSummary(): string {
		if (equipment.length === 0) return translate(lang, 'builder.pickAnyEquipment');
		return equipment.map((item) => labelEquipment(item, lang)).join(', ');
	}

	function musclesSummary(): string {
		if (zones.length === 0) return translate(lang, 'builder.pickAnyMuscles');
		return zones.map((zone) => labelCatalogZone(zone, lang)).join(', ');
	}
</script>

<SeoHead title={translate(lang, 'builder.kitTitle')} noindex />

<div class="content-page builder-pick">
	<ScreenHeader
		title={translate(lang, 'builder.kitTitle')}
		backHref="/builder"
		backLabel={translate(lang, 'builder.title')}
		backLabelVisible
	/>

	<p class="builder-pick__lead">{translate(lang, 'builder.kitLead')}</p>

	<div
		class="builder-pick__progress"
		role="progressbar"
		aria-valuemin={1}
		aria-valuemax={STEP_KEYS.length}
		aria-valuenow={step}
		aria-label={translate(lang, 'builder.pickStepProgress', {
			current: step,
			total: STEP_KEYS.length
		})}
	>
		<span class="builder-pick__progress-fill" style:width={`${progressPct}%`}></span>
	</div>

	<ol class="builder-pick__steps">
		{#each STEP_KEYS as key, index (key)}
			<li
				class="builder-pick__step"
				class:is-current={step === index + 1}
				class:is-done={step > index + 1}
			>
				<span class="builder-pick__step-index" aria-hidden="true">
					{#if step > index + 1}
						<LucideIcon icon={Check} size={ICON_SMALL} />
					{:else}
						{index + 1}
					{/if}
				</span>
				{translate(lang, key)}
			</li>
		{/each}
	</ol>

	{#if loading}
		<Spinner label={translate(lang, 'builder.pickLoading')} />
	{:else if step === 1}
		<section class="builder-pick__section" aria-labelledby="builder-pick-equipment">
			<h2 id="builder-pick-equipment" class="builder-pick__title">
				{translate(lang, 'builder.pickEquipmentTitle')}
			</h2>
			<p class="builder-pick__hint">{translate(lang, 'builder.pickEquipmentHint')}</p>
			<div
				class="builder-pick__chips"
				role="group"
				aria-label={translate(lang, 'builder.pickEquipmentTitle')}
			>
				{#each visibleFacets as facet (facet.equipment)}
					<AppChip
						active={equipment.includes(facet.equipment)}
						onclick={() => toggleEquipment(facet.equipment)}
					>
						{labelEquipment(facet.equipment, lang)}
						<span class="builder-pick__chip-count">{facet.count}</span>
					</AppChip>
				{/each}
			</div>
			{#if allFacets.length > EQUIPMENT_PREVIEW}
				<button
					type="button"
					class="builder-pick__more"
					aria-expanded={showAllEquipment}
					onclick={() => (showAllEquipment = !showAllEquipment)}
				>
					{translate(
						lang,
						showAllEquipment ? 'builder.pickEquipmentLess' : 'builder.pickEquipmentAll'
					)}
				</button>
			{/if}
		</section>
	{:else if step === 2}
		<section class="builder-pick__section" aria-labelledby="builder-pick-muscles">
			<h2 id="builder-pick-muscles" class="builder-pick__title">
				{translate(lang, 'builder.pickMusclesTitle')}
			</h2>
			<p class="builder-pick__hint">{translate(lang, 'builder.pickMusclesHint')}</p>
			<div
				class="builder-pick__zones"
				role="group"
				aria-label={translate(lang, 'builder.pickMusclesTitle')}
			>
				{#each zoneList as zone (zone)}
					<button
						type="button"
						class="builder-pick__zone"
						class:is-active={zones.includes(zone)}
						aria-pressed={zones.includes(zone)}
						onclick={() => toggleZone(zone)}
					>
						<span class="builder-pick__zone-label">{labelCatalogZone(zone, lang)}</span>
						<span class="builder-pick__zone-count">{zoneCounts.get(zone) ?? 0}</span>
					</button>
				{/each}
			</div>
		</section>
	{:else}
		<section class="builder-pick__section" aria-labelledby="builder-pick-exercises">
			<h2 id="builder-pick-exercises" class="builder-pick__title">
				{translate(lang, 'builder.pickExercisesTitle')}
			</h2>
			<p class="builder-pick__summary">
				<span>{equipmentSummary()}</span>
				<span aria-hidden="true">·</span>
				<span>{musclesSummary()}</span>
			</p>
			{#if shown.length === 0}
				<EmptyState
					centered
					icon={SlidersHorizontal}
					title={translate(lang, 'builder.pickEmpty')}
					description={translate(lang, 'builder.pickEmptyDesc')}
					actionLabel={translate(lang, 'builder.pickReset')}
					actionOnclick={resetFilters}
				/>
			{:else}
				<p class="builder-pick__hint">
					{translate(lang, 'builder.pickExercisesHint', {
						shown: shown.length,
						total: matches.length
					})}
				</p>
				<ul class="builder-pick__list">
					{#each shown as exercise (exercise.id)}
						<li>
							<ExerciseCard
								{exercise}
								variant="list"
								detailFrom="/builder/equipment"
							/>
						</li>
					{/each}
				</ul>
				{#if matches.length > shown.length}
					<p class="builder-pick__hint">
						{translate(lang, 'builder.pickNarrow')}
					</p>
				{/if}
			{/if}
		</section>
	{/if}

	{#if !loading}
		<div class="builder-pick__nav">
			<AppButton variant="secondary" block onclick={back}>
				<LucideIcon icon={ArrowLeft} size={ICON_SMALL} />
				{translate(lang, 'builder.pickBack')}
			</AppButton>
			<AppButton block onclick={next}>
				{translate(lang, step === STEP_KEYS.length ? 'builder.pickDone' : 'builder.pickNext')}
				{#if step < STEP_KEYS.length}
					<LucideIcon icon={ArrowRight} size={ICON_SMALL} />
				{/if}
			</AppButton>
		</div>
	{/if}
</div>
