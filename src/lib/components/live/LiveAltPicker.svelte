<script lang="ts">
	import { exerciseName } from '$lib/domain/exerciseName';
	import type { ExerciseIndexItem, SessionExercise } from '$lib/domain/types';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';

	let {
		members,
		names,
		lang,
		onConfirm
	}: {
		members: SessionExercise[];
		names: Map<string, ExerciseIndexItem>;
		lang: AppLocale;
		onConfirm: (exerciseId: string) => void;
	} = $props();

	let selectedId = $state<string | null>(null);

	$effect(() => {
		const first = members[0]?.exerciseId ?? null;
		if (!selectedId || !members.some((m) => m.exerciseId === selectedId)) {
			selectedId = first;
		}
	});

	function titleFor(id: string): string {
		const item = names.get(id);
		return item ? exerciseName(item, lang) : translate(lang, 'records.fallback', { id });
	}
</script>

<div class="live-alt-picker panel" role="group" aria-labelledby="live-alt-picker-title">
	<p id="live-alt-picker-title" class="live-alt-picker__title">
		{translate(lang, 'live.pickAlternative')}
	</p>
	<p class="live-alt-picker__hint">{translate(lang, 'live.pickAlternativeHint')}</p>
	<ul class="live-alt-picker__list">
		{#each members as ex (ex.exerciseId)}
			{@const meta = names.get(ex.exerciseId)}
			<li>
				<button
					type="button"
					class="live-alt-picker__option"
					data-active={selectedId === ex.exerciseId}
					onclick={() => (selectedId = ex.exerciseId)}
				>
					{#if meta}
						<span class="media-well live-alt-picker__thumb">
							<img src={`/${meta.image}`} alt="" width="72" height="72" />
						</span>
					{:else}
						<span class="media-well live-alt-picker__thumb is-placeholder" aria-hidden="true"></span>
					{/if}
					<span class="live-alt-picker__copy">
						<span class="live-alt-picker__name">{titleFor(ex.exerciseId)}</span>
						<span class="live-alt-picker__meta tabular-nums">
							{ex.targetSets} × {ex.targetReps}
						</span>
					</span>
				</button>
			</li>
		{/each}
	</ul>
	<button
		type="button"
		class="btn-primary btn-block min-h-12"
		disabled={!selectedId}
		onclick={() => {
			if (selectedId) onConfirm(selectedId);
		}}
	>
		{translate(lang, 'live.pickAlternativeContinue')}
	</button>
</div>
