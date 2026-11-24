<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import ListSearchBar from '$lib/components/ListSearchBar.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { MagnifyingGlass as Search, Sparkle } from 'phosphor-svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { exerciseName } from '$lib/domain/exerciseName';
	import {
		POPULAR_EXERCISE_IDS,
		frequentExercises
	} from '$lib/domain/exerciseFrequency';
	import { filterExercises, isBodyPart, uniqueSorted } from '$lib/domain/filters';
	import { HOME_EQUIPMENT_FILTER, resolveHomeKitGroups } from '$lib/domain/homeKit';
	import { exerciseMetaHint, labelBodyPart } from '$lib/domain/labels.ru';
	import { replacementCandidateItems } from '$lib/domain/replacementCandidates';
	import type { BodyPart, ExerciseIndexItem, WorkoutSession } from '$lib/domain/types';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { athleteProfile, homeKitSelection } from '$lib/stores/prefs';

	const SEARCH_CAP = 40;
	const SUGGEST_CAP = 12;

	type Mode = 'replace' | 'add';
	type ZoneFilter = BodyPart | 'all';

	type Props = {
		open: boolean;
		mode: Mode;
		catalog: ExerciseIndexItem[];
		history?: WorkoutSession[];
		/** Replace: open on this zone (current exercise body_part). */
		seedBodyPart?: string | null;
		/** Replace: the exercise being swapped — drives the smart substitute order. */
		seedExerciseId?: string | null;
		/** Replace: ids already in this workout (other slots), never offered as a swap. */
		excludeIds?: readonly string[];
		lang: AppLocale;
		busy?: boolean;
		onPick: (exerciseId: string) => void;
		onDismiss: () => void;
	};

	let {
		open,
		mode,
		catalog,
		history = [],
		seedBodyPart = null,
		seedExerciseId = null,
		excludeIds = [],
		lang,
		busy = false,
		onPick,
		onDismiss
	}: Props = $props();

	/** One select instead of a chip wall: `all` | `home` | `part:<body_part>`. */
	const PART_PREFIX = 'part:';

	let query = $state('');
	let zone = $state('all');
	let bodyPart = $derived<ZoneFilter>(
		zone.startsWith(PART_PREFIX) ? (zone.slice(PART_PREFIX.length) as BodyPart) : 'all'
	);
	let equipment = $derived<'all' | typeof HOME_EQUIPMENT_FILTER>(
		zone === 'home' ? HOME_EQUIPMENT_FILTER : 'all'
	);

	$effect(() => {
		if (!open) {
			query = '';
			zone = 'all';
			return;
		}
		query = '';
		zone =
			mode === 'replace' && seedBodyPart && isBodyPart(seedBodyPart)
				? `${PART_PREFIX}${seedBodyPart}`
				: 'all';
	});

	let byId = $derived.by(() => {
		const map = new Map<string, ExerciseIndexItem>();
		for (const item of catalog) map.set(item.id, item);
		return map;
	});

	// Localized order: in a select the list is scanned alphabetically, not by the
	// English `body_part` key.
	let zoneParts = $derived.by(() => {
		const parts = uniqueSorted(catalog, 'body_part').filter(isBodyPart);
		return parts.sort((a, b) =>
			labelBodyPart(a, lang).localeCompare(labelBodyPart(b, lang), lang === 'en' ? 'en' : 'ru')
		);
	});

	/** What the athlete actually trains: a familiar substitute is an easy yes. */
	let frequentIds = $derived.by(() =>
		frequentExercises(history, { limit: SUGGEST_CAP }).map((f) => f.exerciseId)
	);

	let suggestItems = $derived.by(() => {
		const ids = frequentIds.length > 0 ? frequentIds : [...POPULAR_EXERCISE_IDS];
		const out: ExerciseIndexItem[] = [];
		const seen = new Set<string>();
		for (const id of ids) {
			if (seen.has(id)) continue;
			const item = byId.get(id);
			if (!item) continue;
			seen.add(id);
			out.push(item);
			if (out.length >= SUGGEST_CAP) break;
		}
		return out;
	});

	/**
	 * Home gear only counts when the athlete really trains at home — a gym athlete
	 * sees the whole gym catalog.
	 */
	let homeKit = $derived(
		$athleteProfile.trainingPlace === 'home'
			? resolveHomeKitGroups($homeKitSelection)
			: null
	);

	/** The exercise being replaced, when the caller knows it. */
	let seed = $derived.by(() => (seedExerciseId ? (byId.get(seedExerciseId) ?? null) : null));
	let seedZone = $derived(
		mode === 'replace' && seed && isBodyPart(seed.body_part) ? `${PART_PREFIX}${seed.body_part}` : null
	);

	/**
	 * Smart substitutes: replacing, nothing typed, and the athlete hasn't walked
	 * away from the seeded zone. Any search or zone change falls back to the plain
	 * catalog filter, so the ordering never fights what the athlete asked for.
	 */
	let smartList = $derived.by(() => {
		if (!seedZone || zone !== seedZone || !seed || query.trim()) return null;
		return replacementCandidateItems(catalog, seed, {
			limit: SEARCH_CAP,
			// Never offer a lift that is already scheduled in this workout.
			excludeIds,
			familiarIds: frequentIds,
			homeKit
		});
	});

	/**
	 * Typing means "search everything": the zone starts seeded to the exercise
	 * being replaced, so keeping it would turn «присед» into an empty list. A zone
	 * the athlete picked themselves still narrows the search.
	 */
	let queryIgnoresSeedZone = $derived(!!query.trim() && seedZone !== null && zone === seedZone);
	let searchBodyPart = $derived(queryIgnoresSeedZone ? 'all' : bodyPart);
	let searchEquipment = $derived<'all' | typeof HOME_EQUIPMENT_FILTER>(
		queryIgnoresSeedZone ? 'all' : equipment
	);

	let results = $derived.by(() => {
		if (smartList) return smartList;
		const q = query.trim();
		if (!q && searchBodyPart === 'all' && searchEquipment === 'all') return suggestItems;
		return filterExercises(
			catalog,
			{
				query: q,
				bodyPart: searchBodyPart,
				equipment: searchEquipment,
				target: 'all',
				...(searchEquipment === HOME_EQUIPMENT_FILTER ? { homeKit: $homeKitSelection } : {})
			},
			lang
		).slice(0, SEARCH_CAP);
	});

	let titleKey = $derived(
		mode === 'replace' ? 'live.replaceExerciseTitle' : 'live.addExerciseTitle'
	);
	let emptyHintKey = $derived(
		query.trim() || searchBodyPart !== 'all' || searchEquipment !== 'all'
			? 'live.pickExerciseEmptyHint'
			: 'live.pickExerciseSuggest'
	);
</script>

<BottomSheet {open} titleId="live-exercise-pick-title" {onDismiss} dismissible={!busy} raised>
	<div class="live-exercise-pick">
		<div class="bottom-sheet__head">
			<p id="live-exercise-pick-title" class="bottom-sheet__title">
				{translate(lang, titleKey)}
			</p>
		</div>
		{#if mode === 'replace'}
			<p class="bottom-sheet__hint">{translate(lang, 'live.replaceExerciseHint')}</p>
		{/if}

		<div class="live-exercise-pick__search">
			<ListSearchBar
				bind:value={query}
				placeholder={translate(lang, 'live.pickExerciseSearch')}
				debounceMs={120}
			/>
		</div>

		<div class="live-exercise-pick__filters">
			<select
				class="field live-exercise-pick__zone"
				value={zone}
				disabled={busy}
				aria-label={translate(lang, 'catalog.bodyPart')}
				onchange={(e) => (zone = e.currentTarget.value)}
			>
				<option value="all">{translate(lang, 'exercises.all')}</option>
				<option value="home">{translate(lang, 'place.home')}</option>
				{#each zoneParts as part (part)}
					<option value={`${PART_PREFIX}${part}`}>{labelBodyPart(part, lang)}</option>
				{/each}
			</select>
		</div>

		{#if smartList}
			<p class="live-exercise-pick__suggest">
				<LucideIcon icon={Sparkle} size={ICON_SMALL} />
				{translate(lang, 'live.replaceSuggest')}
			</p>
		{/if}

		{#if results.length === 0}
			<div class="live-exercise-pick__empty" role="status">
				<div class="live-exercise-pick__empty-icon" aria-hidden="true">
					<LucideIcon icon={Search} size={22} />
				</div>
				<p class="live-exercise-pick__empty-title">{translate(lang, 'live.pickExerciseEmpty')}</p>
				<p class="live-exercise-pick__empty-hint">{translate(lang, emptyHintKey)}</p>
			</div>
		{:else}
			<ul class="live-exercise-pick__list">
				{#each results as item (item.id)}
					<li>
						<button
							type="button"
							class="live-exercise-pick__row"
							disabled={busy}
							onclick={() => onPick(item.id)}
						>
							<span class="live-exercise-pick__thumb media-well" aria-hidden="true">
								{#if item.image}
									<img
										src={`/${item.image}`}
										alt=""
										width="48"
										height="48"
										loading="lazy"
										decoding="async"
									/>
								{/if}
							</span>
							<span class="live-exercise-pick__text">
								<span class="live-exercise-pick__name">{exerciseName(item, lang)}</span>
								<span class="live-exercise-pick__meta">{exerciseMetaHint(item, lang)}</span>
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</BottomSheet>
