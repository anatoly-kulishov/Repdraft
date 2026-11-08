<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import ListSearchBar from '$lib/components/ListSearchBar.svelte';
	import { exerciseName } from '$lib/domain/exerciseName';
	import {
		POPULAR_EXERCISE_IDS,
		frequentExercises
	} from '$lib/domain/exerciseFrequency';
	import { filterExercises, isBodyPart, uniqueSorted } from '$lib/domain/filters';
	import { exerciseMetaHint, labelBodyPart } from '$lib/domain/labels.ru';
	import type { BodyPart, ExerciseIndexItem, WorkoutSession } from '$lib/domain/types';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';

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
		lang,
		busy = false,
		onPick,
		onDismiss
	}: Props = $props();

	let query = $state('');
	let bodyPart = $state<ZoneFilter>('all');

	$effect(() => {
		if (!open) {
			query = '';
			bodyPart = 'all';
			return;
		}
		query = '';
		if (mode === 'replace' && seedBodyPart && isBodyPart(seedBodyPart)) bodyPart = seedBodyPart;
		else bodyPart = 'all';
	});

	let byId = $derived.by(() => {
		const map = new Map<string, ExerciseIndexItem>();
		for (const item of catalog) map.set(item.id, item);
		return map;
	});

	let zoneParts = $derived(uniqueSorted(catalog, 'body_part'));

	let suggestItems = $derived.by(() => {
		const freq = frequentExercises(history, { limit: SUGGEST_CAP });
		const ids =
			freq.length > 0 ? freq.map((f) => f.exerciseId) : [...POPULAR_EXERCISE_IDS];
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

	let results = $derived.by(() => {
		const q = query.trim();
		if (!q && bodyPart === 'all') return suggestItems;
		return filterExercises(
			catalog,
			{ query: q, bodyPart, equipment: 'all', target: 'all' },
			lang
		).slice(0, SEARCH_CAP);
	});

	let titleKey = $derived(
		mode === 'replace' ? 'live.replaceExerciseTitle' : 'live.addExerciseTitle'
	);
	let emptyHintKey = $derived(
		query.trim() || bodyPart !== 'all' ? 'live.pickExerciseEmpty' : 'live.pickExerciseSuggest'
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

		<div class="live-exercise-pick__chips" role="toolbar" aria-label={translate(lang, 'catalog.bodyPart')}>
			<button
				type="button"
				class="live-exercise-pick__chip"
				class:is-on={bodyPart === 'all'}
				disabled={busy}
				onclick={() => {
					bodyPart = 'all';
				}}
			>
				{translate(lang, 'exercises.all')}
			</button>
			{#each zoneParts as part (part)}
				{#if isBodyPart(part)}
					<button
						type="button"
						class="live-exercise-pick__chip"
						class:is-on={bodyPart === part}
						disabled={busy}
						onclick={() => {
							bodyPart = part;
						}}
					>
						{labelBodyPart(part, lang)}
					</button>
				{/if}
			{/each}
		</div>

		{#if results.length === 0}
			<p class="bottom-sheet__hint">{translate(lang, emptyHintKey)}</p>
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
