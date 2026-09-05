<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { visibleSessionExerciseIndices } from '$lib/domain/session';
	import type { ExerciseIndexItem, WorkoutSession } from '$lib/domain/types';
	import { formatLadderLabel, groupMemberRole } from '$lib/domain/workout';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { Check, Link2 } from '@lucide/svelte';

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
		const planned = ex.sets.map((s) => s.reps).filter((r): r is number => r != null);
		if (planned.length >= 2 && new Set(planned).size > 1) {
			return `${ex.sets.length} · ${formatLadderLabel(planned)}`;
		}
		return `${ex.sets.length} × ${ex.targetReps}`;
	}

	$effect(() => {
		selectedExerciseIndex;
		if (typeof document === 'undefined') return;
		const id = window.setTimeout(() => {
			const el = document.querySelector<HTMLElement>(`.live-nav-item[data-active='true']`);
			el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
		}, 0);
		return () => window.clearTimeout(id);
	});
</script>

{#snippet navButton(ei: number, inGroup: boolean)}
	{@const ex = session.exercises[ei]!}
	<AppButton
		variant="ghost"
		class="live-nav-item"
		data-active={ei === selectedExerciseIndex}
		data-done={exerciseDone(ei)}
		aria-current={ei === selectedExerciseIndex ? 'true' : undefined}
		onclick={() => onSelect(ei)}
	>
		<span class="live-nav-copy">
			<span class="live-nav-title">{titleFor(ex.exerciseId)}</span>
			<span class="live-nav-meta">{metaFor(ei, inGroup)}</span>
		</span>
		{#if exerciseDone(ei)}
			<span class="live-nav-check" aria-hidden="true">
				<LucideIcon icon={Check} size={ICON_SMALL} />
			</span>
		{/if}
	</AppButton>
{/snippet}

<nav class="live-nav" aria-label={translate(lang, 'live.title')}>
	<ul class="live-nav-list">
		{#each segments as segment (segment.kind === 'solo' ? `solo-${segment.index}` : `group-${segment.indices.join('-')}`)}
			{#if segment.kind === 'solo'}
				<li class="live-nav-li">
					{@render navButton(segment.index, false)}
				</li>
			{:else}
				<li class="live-nav-chain" aria-label={translate(lang, 'builder.supersetBadge')}>
					{#each segment.indices as ei, gi (ei)}
						{#if gi > 0}
							<span class="live-nav-chain__link" aria-hidden="true">
								<LucideIcon icon={Link2} size={ICON_SMALL} />
							</span>
						{/if}
						{@render navButton(ei, true)}
					{/each}
				</li>
			{/if}
		{/each}
	</ul>
</nav>
