<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppLabel from '$lib/components/AppLabel.svelte';
	import AppTextarea from '$lib/components/AppTextarea.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { AI_TUNE_NOTE_MAX, sanitizeAiBrief } from '$lib/domain/inputLimits';
	import { nextGoalNote } from '$lib/domain/aiTuneGoalNote';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { toasts } from '$lib/stores/toasts';
	import { browser } from '$app/environment';
	import { Sparkles } from '@lucide/svelte';

	type TuneGoal = 'strength' | 'hypertrophy' | 'endurance' | 'general';

	type Prescription = {
		sets: number;
		reps: number;
		restSec: number;
		why: string;
	};

	let {
		open = false,
		exerciseId,
		titleId,
		sets,
		reps,
		restSec,
		lang,
		onDismiss,
		onApply
	}: {
		open?: boolean;
		exerciseId: string;
		titleId: string;
		sets: number;
		reps: number;
		restSec: number;
		lang: AppLocale;
		onDismiss: () => void;
		onApply: (patch: { sets: number; reps: number; restSec: number }) => void;
	} = $props();

	const GOALS: TuneGoal[] = ['strength', 'hypertrophy', 'endurance', 'general'];
	const DEFAULT_GOAL: TuneGoal = 'hypertrophy';

	function goalTemplate(g: TuneGoal): string {
		switch (g) {
			case 'strength':
				return translate(lang, 'builder.aiTuneGoalHintStrength');
			case 'hypertrophy':
				return translate(lang, 'builder.aiTuneGoalHintHypertrophy');
			case 'endurance':
				return translate(lang, 'builder.aiTuneGoalHintEndurance');
			case 'general':
				return translate(lang, 'builder.aiTuneGoalHintGeneral');
			default: {
				const _exhaustive: never = g;
				return _exhaustive;
			}
		}
	}

	let goal = $state<TuneGoal>(DEFAULT_GOAL);
	let note = $state(goalTemplate(DEFAULT_GOAL));
	let refineNote = $state('');
	let busy = $state(false);
	let result = $state<Prescription | null>(null);
	let gen = 0;

	function goalLabel(g: TuneGoal): string {
		switch (g) {
			case 'strength':
				return translate(lang, 'builder.aiTuneGoalStrength');
			case 'hypertrophy':
				return translate(lang, 'builder.aiTuneGoalHypertrophy');
			case 'endurance':
				return translate(lang, 'builder.aiTuneGoalEndurance');
			case 'general':
				return translate(lang, 'builder.aiTuneGoalGeneral');
			default: {
				const _exhaustive: never = g;
				return _exhaustive;
			}
		}
	}

	/** Prefill / swap note when picking a chip; keep custom user edits. */
	function selectGoal(g: TuneGoal) {
		note = nextGoalNote(
			note,
			goalTemplate(g),
			GOALS.map((x) => goalTemplate(x))
		);
		goal = g;
	}

	async function requestTune(opts: { noteText: string; prior: Prescription | null }) {
		if (busy) return;
		if (browser && !navigator.onLine) {
			toasts.show(translate(lang, 'builder.aiTuneOffline'), 'info');
			return;
		}
		const myGen = ++gen;
		busy = true;
		try {
			const body: Record<string, unknown> = {
				exerciseId,
				sets,
				reps,
				restSec,
				goal,
				lang,
				note: sanitizeAiBrief(opts.noteText, AI_TUNE_NOTE_MAX)
			};
			if (opts.prior) {
				body.prior = {
					sets: opts.prior.sets,
					reps: opts.prior.reps,
					restSec: opts.prior.restSec,
					why: opts.prior.why
				};
			}
			const res = await fetch('/api/ai/tune', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data = (await res.json()) as {
				ok?: boolean;
				prescription?: Prescription;
				error?: string;
				code?: string;
			};
			if (myGen !== gen) return;
			if (!res.ok || !data.ok || !data.prescription) {
				const authFail =
					res.status === 503 ||
					data.code === 'unavailable' ||
					/oauth|authorization|credentials|api.?key/i.test(data.error ?? '');
				toasts.show(
					translate(lang, authFail ? 'builder.aiTuneFailAuth' : 'builder.aiTuneFail'),
					'error'
				);
				return;
			}
			result = data.prescription;
			refineNote = '';
		} catch {
			if (myGen !== gen) return;
			toasts.show(translate(lang, 'builder.aiTuneFail'), 'error');
		} finally {
			if (myGen === gen) busy = false;
		}
	}

	function suggest() {
		void requestTune({ noteText: note, prior: null });
	}

	function refine() {
		if (!result) return;
		const text = sanitizeAiBrief(refineNote, AI_TUNE_NOTE_MAX);
		if (!text) return;
		void requestTune({ noteText: text, prior: result });
	}

	function apply() {
		if (!result) return;
		onApply({
			sets: result.sets,
			reps: result.reps,
			restSec: result.restSec
		});
		onDismiss();
	}
</script>

<BottomSheet
	{open}
	raised
	{titleId}
	onDismiss={() => {
		if (busy) return;
		onDismiss();
	}}
>
	<p id={titleId} class="bottom-sheet__title">{translate(lang, 'builder.aiTuneTitle')}</p>
	<p class="bottom-sheet__hint">{translate(lang, 'builder.aiTuneHint')}</p>

	<div class="builder-ai-tune">
		<div
			class="catalog-filter-chips builder-ai-tune__goals"
			role="group"
			aria-label={translate(lang, 'builder.aiTuneGoalAria')}
		>
			{#each GOALS as g (g)}
				<button
					type="button"
					class="catalog-filter-chip"
					class:is-active={goal === g}
					disabled={busy}
					onclick={() => selectGoal(g)}
				>
					{goalLabel(g)}
				</button>
			{/each}
		</div>

		{#if !result}
			<AppLabel class="builder-ai-tune__field" for={`builder-ai-tune-note-${exerciseId}`}>
				{translate(lang, 'builder.aiTuneNote')}
			</AppLabel>
			<AppTextarea
				id={`builder-ai-tune-note-${exerciseId}`}
				class="builder-ai-tune__note"
				rows={2}
				maxlength={AI_TUNE_NOTE_MAX}
				disabled={busy}
				placeholder={translate(lang, 'builder.aiTuneNotePlaceholder')}
				bind:value={note}
			/>
			<AppButton variant="primary" block disabled={busy} onclick={suggest}>
				<span class="builder-ai-tune__cta">
					<LucideIcon icon={Sparkles} size={ICON_SMALL} />
					{busy
						? translate(lang, 'builder.aiTuneBusy')
						: translate(lang, 'builder.aiTuneSuggest')}
				</span>
			</AppButton>
		{:else}
			<div class="builder-ai-tune__result" aria-live="polite">
				<p class="builder-ai-tune__numbers tabular-nums">
					{result.sets} × {result.reps}
					<span class="builder-ai-tune__rest">· {result.restSec}s</span>
				</p>
				{#if result.why}
					<p class="builder-ai-tune__why">{result.why}</p>
				{/if}
			</div>
			<AppButton variant="primary" block disabled={busy} onclick={apply}>
				{translate(lang, 'builder.aiTuneApply')}
			</AppButton>
			<AppLabel class="builder-ai-tune__field" for={`builder-ai-tune-refine-${exerciseId}`}>
				{translate(lang, 'builder.aiTuneRefine')}
			</AppLabel>
			<AppTextarea
				id={`builder-ai-tune-refine-${exerciseId}`}
				class="builder-ai-tune__note"
				rows={2}
				maxlength={AI_TUNE_NOTE_MAX}
				disabled={busy}
				placeholder={translate(lang, 'builder.aiTuneRefinePlaceholder')}
				bind:value={refineNote}
			/>
			<AppButton
				variant="secondary"
				block
				disabled={busy || !sanitizeAiBrief(refineNote, AI_TUNE_NOTE_MAX)}
				onclick={refine}
			>
				{busy ? translate(lang, 'builder.aiTuneBusy') : translate(lang, 'builder.aiTuneAgain')}
			</AppButton>
		{/if}
	</div>
</BottomSheet>
