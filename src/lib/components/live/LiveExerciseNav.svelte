<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { visibleSessionExerciseIndices } from '$lib/domain/session';
	import type { ExerciseIndexItem, WorkoutSession } from '$lib/domain/types';
	import { groupMemberRole } from '$lib/domain/workout';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { Check } from '@lucide/svelte';

	let {
		session,
		selectedExerciseIndex,
		names,
		lang,
		onSelect
	}: {
		session: WorkoutSession;
		selectedExerciseIndex: number;
		names: Map<string, ExerciseIndexItem>;
		lang: AppLocale;
		onSelect: (index: number) => void;
	} = $props();

	type NavSegment =
		| { kind: 'solo'; index: number }
		| { kind: 'group'; indices: number[] };

	let visible = $derived(visibleSessionExerciseIndices(session));

	let segments = $derived.by((): NavSegment[] => {
		const out: NavSegment[] = [];
		let i = 0;
		while (i < visible.length) {
			const ei = visible[i]!;
			const role = groupMemberRole(session.exercises, ei);
			if (role === 'solo') {
				out.push({ kind: 'solo', index: ei });
				i += 1;
				continue;
			}
			const indices = [ei];
			i += 1;
			while (i < visible.length) {
				const next = visible[i]!;
				const nextRole = groupMemberRole(session.exercises, next);
				if (nextRole === 'middle' || nextRole === 'last') {
					indices.push(next);
					i += 1;
					if (nextRole === 'last') break;
				} else {
					break;
				}
			}
			out.push({ kind: 'group', indices });
		}
		return out;
	});

	function titleFor(id: string): string {
		const item = names.get(id);
		return item ? exerciseName(item, lang) : translate(lang, 'records.fallback', { id });
	}

	function exerciseDone(index: number): boolean {
		const ex = session.exercises[index];
		if (!ex || ex.sets.length === 0) return false;
		return ex.sets.every((s) => s.completed);
	}

	function metaFor(index: number, inGroup: boolean): string {
		const ex = session.exercises[index];
		if (!ex) return '';
		if (inGroup) return translate(lang, 'live.lastReps', { n: ex.targetReps });
		return `${ex.sets.length} × ${ex.targetReps}`;
	}
</script>

{#snippet navButton(ei: number, inGroup: boolean)}
	{@const ex = session.exercises[ei]!}
	<button
		type="button"
		class="live-nav-item"
		class:live-nav-item--in-group={inGroup}
		data-active={ei === selectedExerciseIndex}
		data-done={exerciseDone(ei)}
		onclick={() => onSelect(ei)}
	>
		<span class="live-nav-title">{titleFor(ex.exerciseId)}</span>
		<span class="live-nav-meta">{metaFor(ei, inGroup)}</span>
		{#if exerciseDone(ei)}
			<span class="live-nav-check" aria-hidden="true">
				<LucideIcon icon={Check} size={ICON_SMALL} />
			</span>
		{/if}
	</button>
{/snippet}

<nav class="live-nav" aria-label={translate(lang, 'live.title')}>
	<ul class="live-nav-list">
		{#each segments as segment (segment.kind === 'solo' ? `solo-${segment.index}` : `group-${segment.indices.join('-')}`)}
			{#if segment.kind === 'solo'}
				<li class="live-nav-li">
					{@render navButton(segment.index, false)}
				</li>
			{:else}
				<li class="live-nav-group">
					<p class="live-nav-group-badge">{translate(lang, 'builder.supersetBadge')}</p>
					<div class="live-nav-group__row">
						{#each segment.indices as ei (ei)}
							{@render navButton(ei, true)}
						{/each}
					</div>
				</li>
			{/if}
		{/each}
	</ul>
</nav>
