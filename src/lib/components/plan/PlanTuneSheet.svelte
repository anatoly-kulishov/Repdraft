<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppLabel from '$lib/components/AppLabel.svelte';
	import AppTextarea from '$lib/components/AppTextarea.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { MetalFx, ThinkingOrbs } from '$lib/components/fx';
	import { prefersReducedMotion } from '$lib/components/fx/motion';
	import { AI_BRIEF_MAX, sanitizeAiBrief } from '$lib/domain/inputLimits';
	import {
		applyPlanTune,
		diffPlanTune,
		normalizePlanTuneRows,
		planTuneRows,
		type PlanTune
	} from '$lib/domain/planTune';
	import type { ExerciseIndexItem, WorkoutPlan } from '$lib/domain/types';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate, translatePlural } from '$lib/i18n/messages';
	import { scrollFieldIntoView } from '$lib/dom/scrollFieldIntoView';
	import { toasts } from '$lib/stores/toasts';
	import { Sparkle as Sparkles } from 'phosphor-svelte';
	import type { TransitionConfig } from 'svelte/transition';

	let {
		open = $bindable(false),
		plan,
		indexById,
		lang,
		startBlocked = false,
		onDismiss,
		onStart,
		onSave
	}: {
		open?: boolean;
		plan: WorkoutPlan;
		indexById: Map<string, ExerciseIndexItem>;
		lang: AppLocale;
		/** An unfinished session owns the live screen; starting a tuned one would drop it. */
		startBlocked?: boolean;
		onDismiss: () => void;
		onStart: (tuned: WorkoutPlan) => void | Promise<void>;
		onSave: (tuned: WorkoutPlan) => void | Promise<void>;
	} = $props();

	const PRESETS = [
		'planTune.preset.shoulder',
		'planTune.preset.back',
		'planTune.preset.knee',
		'planTune.preset.chest',
		'planTune.preset.arms',
		'planTune.preset.lighter',
		'planTune.preset.shorter'
	] as const;

	let brief = $state('');
	let busy = $state(false);
	let result = $state<PlanTune | null>(null);
	let saving = $state(false);
	let gen = 0;
	/** Inline error beats a toast: it points at the exact field that needs words. */
	let briefError = $state(false);
	let briefEl = $state<HTMLElement | null>(null);
	let swapHost = $state<HTMLElement | null>(null);
	/** Explicit height lets the sheet glide between panes instead of snapping. */
	let paneH = $state<number | null>(null);
	/** Same words + same plan = same answer; never spend a second AI call on it. */
	let lastTune = $state<{ key: string; result: PlanTune } | null>(null);
	let cooldownUntil = 0;

	const RETRY_COOLDOWN_MS = 3000;
	/** The old copy must be gone before the new one appears (see `swapIn`). */
	const SWAP_OUT_MS = 110;
	const SWAP_IN_MS = 300;

	let tuned = $derived(result ? applyPlanTune(plan, result) : null);
	let diff = $derived(result ? diffPlanTune(planTuneRows(plan.exercises), tuned!.exercises) : null);
	/** Only a real content change waves: pressing «Подобрать» keeps the form steady. */
	let paneKey = $derived(result ? 'result' : 'form');

	/**
	 * Fade-through, not a wave wipe: a moving edge between two text layouts leaves
	 * both copies readable at once (form chips under the diff rows), which reads as
	 * a glitch. The old pane is gone before the new one starts to appear.
	 */
	function swapOut(_node: Element): TransitionConfig {
		// Closing resets the sheet back to the form; that must happen silently
		// under the slide-down, not as a visible swap.
		if (!open || prefersReducedMotion()) return { duration: 0 };
		// `out` runs t: 1 → 0, so `opacity: t` fades the leaving pane 1 → 0.
		return { duration: SWAP_OUT_MS, css: (t) => `opacity:${t};` };
	}

	function swapIn(_node: Element): TransitionConfig {
		if (!open || prefersReducedMotion()) return { duration: 0 };
		const hold = SWAP_OUT_MS / SWAP_IN_MS;
		return {
			duration: SWAP_IN_MS,
			css: (t) => {
				/* Stay invisible while the old pane clears, then rise into place. */
				const p = Math.max(0, (t - hold) / (1 - hold));
				const eased = 1 - (1 - p) ** 3;
				return `opacity:${eased};transform:translateY(${((1 - eased) * 8).toFixed(2)}px);`;
			}
		};
	}

	$effect(() => {
		// Re-attach on every swap: the incoming pane is the last one in DOM order.
		void paneKey;
		const host = swapHost;
		if (!host) return;
		const incoming = host.querySelector<HTMLElement>('.plan-tune__swap-pane:last-child > *');
		if (!incoming) return;
		const sync = () => {
			const h = Math.round(incoming.getBoundingClientRect().height);
			if (h > 0 && h !== paneH) paneH = h;
		};
		sync();
		const ro = new ResizeObserver(sync);
		ro.observe(incoming);
		return () => ro.disconnect();
	});

	$effect(() => {
		// Closing resets back to the form, but with no visible swap (guarded above).
		// Reopening should offer the input again, not a stale preview.
		if (!open && (result !== null || brief !== '' || briefError)) reset();
	});

	function tuneKey(text: string): string {
		return `${plan.id}:${plan.updatedAt}:${text}`;
	}
	let metaText = $derived.by(() => {
		const rows = tuned?.exercises ?? [];
		const sets = rows.reduce((sum, ex) => sum + ex.sets, 0);
		return `${translatePlural(lang, 'home.pillExercises', rows.length)} · ${translatePlural(lang, 'home.recentSets', sets)}`;
	});

	function nameOf(exerciseId: string): string {
		const item = indexById.get(exerciseId);
		if (!item) return exerciseId;
		return lang === 'en' ? item.name : item.name_ru || item.name;
	}

	function togglePreset(text: string) {
		const t = text.trim();
		if (!t) return;
		if (briefError) briefError = false;
		if (brief.includes(t)) {
			brief = brief.replace(t, '').replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '');
			return;
		}
		const base = brief.trim().replace(/[,;]+$/, '');
		brief = base ? `${base}, ${t.toLowerCase()}` : t;
	}

	function toRows(value: unknown) {
		return normalizePlanTuneRows(value);
	}

	async function requestTune() {
		if (busy || saving) return;
		const text = sanitizeAiBrief(brief, AI_BRIEF_MAX);
		if (!text) {
			briefError = true;
			briefEl?.focus();
			if (briefEl) scrollFieldIntoView(briefEl);
			return;
		}
		briefError = false;

		/* Re-asking the same thing (retry, reopened sheet, second tap) is free:
		   the quota is 10 calls a day, so we answer from the last result. */
		const key = tuneKey(text);
		if (lastTune?.key === key) {
			result = lastTune.result;
			return;
		}
		/* Back-to-back taps after a failure would only burn the remaining calls. */
		if (Date.now() < cooldownUntil) return;
		const myGen = ++gen;
		busy = true;
		result = null;
		try {
			const res = await fetch('/api/ai/tune-plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					brief: text,
					plan: { name: plan.name, exercises: planTuneRows(plan.exercises) }
				})
			});
			const data = (await res.json()) as {
				ok?: boolean;
				plan?: { name?: string; summary?: string; exercises?: unknown };
				code?: string;
			};
			if (myGen !== gen) return;
			const rows = toRows(data.plan?.exercises);
			if (!res.ok || !data.ok || rows.length === 0) {
				cooldownUntil = Date.now() + RETRY_COOLDOWN_MS;
				if (res.status === 429 || data.code === 'rate_limit') {
					toasts.show(translate(lang, 'aiDraft.rateLimit'), 'error');
					return;
				}
				if (res.status === 503 || data.code === 'unavailable') {
					toasts.show(translate(lang, 'aiDraft.unavailable'), 'error');
					return;
				}
				toasts.show(translate(lang, 'planTune.error'), 'error');
				return;
			}
			const tunedResult: PlanTune = {
				name: data.plan?.name ?? null,
				summary: data.plan?.summary ?? null,
				exercises: rows
			};
			lastTune = { key, result: tunedResult };
			result = tunedResult;
		} catch {
			if (myGen !== gen) return;
			cooldownUntil = Date.now() + RETRY_COOLDOWN_MS;
			toasts.show(translate(lang, 'planTune.error'), 'error');
		} finally {
			if (myGen === gen) busy = false;
		}
	}

	function reset() {
		gen += 1;
		brief = '';
		busy = false;
		result = null;
		saving = false;
		briefError = false;
	}

	function dismiss() {
		if (busy || saving) return;
		reset();
		onDismiss();
	}

	async function start() {
		if (!tuned || busy || saving || startBlocked) return;
		const payload = tuned;
		reset();
		await onStart(payload);
	}

	async function save() {
		if (!tuned || busy || saving) return;
		saving = true;
		try {
			await onSave(tuned);
		} finally {
			saving = false;
		}
	}
</script>

<BottomSheet
	{open}
	flush
	titleId="plan-tune-title"
	onDismiss={dismiss}
	dismissible={!busy && !saving}
>
	<p id="plan-tune-title" class="bottom-sheet__title">{translate(lang, 'planTune.title')}</p>

	<div
		class="plan-tune"
		bind:this={swapHost}
		style:height={paneH !== null ? `${paneH}px` : null}
	>
		{#key paneKey}
			<div class="plan-tune__swap-pane" in:swapIn out:swapOut>
				{#if !result}
					<div class="plan-tune__pane">
						<p class="plan-tune__lead">{translate(lang, 'planTune.lead')}</p>
						<div
							class="plan-tune__presets"
							role="group"
							aria-label={translate(lang, 'planTune.presetsLabel')}
						>
							{#each PRESETS as key (key)}
								{@const label = translate(lang, key)}
								{@const active = brief.includes(label)}
								<button
									type="button"
									class="plan-tune__preset"
									class:is-active={active}
									aria-pressed={active}
									disabled={busy}
									onclick={() => togglePreset(label)}
								>
									{label}
								</button>
							{/each}
						</div>

						<div class="plan-tune__field">
							<div class="plan-tune__label-row">
								<AppLabel for="plan-tune-brief">
									{translate(lang, 'planTune.briefLabel')}
								</AppLabel>
								<span class="plan-tune__counter" aria-hidden="true">
									{translate(lang, 'aiDraft.chars', { n: String(brief.length) })}
								</span>
							</div>
							<AppTextarea
								bind:ref={briefEl}
								id="plan-tune-brief"
								class="plan-tune__brief"
								rows={3}
								maxlength={AI_BRIEF_MAX}
								disabled={busy}
								placeholder={translate(lang, 'planTune.placeholder')}
								bind:value={brief}
								aria-invalid={briefError ? 'true' : undefined}
								aria-describedby={briefError
									? 'plan-tune-brief-error'
									: 'plan-tune-brief-hint'}
								oninput={() => {
									if (briefError) briefError = false;
								}}
								onfocus={(e) => {
									if (e.currentTarget instanceof HTMLElement) scrollFieldIntoView(e.currentTarget);
								}}
							/>
							{#if briefError}
								<p id="plan-tune-brief-error" class="plan-tune__error" role="alert">
									{translate(lang, 'planTune.emptyBrief')}
								</p>
							{:else}
								<p id="plan-tune-brief-hint" class="plan-tune__hint">
									{translate(lang, 'planTune.todayOnly')}
								</p>
							{/if}
						</div>

						<MetalFx class="w-full">
							<AppButton variant="primary" block disabled={busy} class="fx-cta-sheen" onclick={requestTune}>
								<span class="plan-tune__cta">
									{#if busy}
										<ThinkingOrbs
											mode="composing"
											size={20}
											label={translate(lang, 'planTune.busy')}
										/>
									{:else}
										<LucideIcon icon={Sparkles} size={ICON_SMALL} />
									{/if}
									{busy ? translate(lang, 'planTune.busy') : translate(lang, 'planTune.submit')}
								</span>
							</AppButton>
						</MetalFx>
					</div>
			{:else}
					<div class="plan-tune__pane" aria-live="polite">
						<p class="plan-tune__preview-title">{translate(lang, 'planTune.previewTitle')}</p>
						{#if result.summary && !diff?.empty}
							<p class="plan-tune__summary">{result.summary}</p>
						{/if}

						{#if diff}
							{#if diff.empty}
								<p class="plan-tune__unchanged">{translate(lang, 'planTune.unchanged')}</p>
							{:else}
								<ul class="plan-tune__diff">
									{#each diff.removed as row (row.exerciseId)}
										<li class="plan-tune__diff-row is-removed">
											<span class="plan-tune__diff-tag">{translate(lang, 'planTune.removed')}</span>
											<span class="plan-tune__diff-name">{nameOf(row.exerciseId)}</span>
											<span class="plan-tune__diff-meta tabular-nums">
												{row.sets} × {row.reps}
											</span>
										</li>
									{/each}
									{#each diff.added as row (row.exerciseId)}
										<li class="plan-tune__diff-row is-added">
											<span class="plan-tune__diff-tag">{translate(lang, 'planTune.added')}</span>
											<span class="plan-tune__diff-name">{nameOf(row.exerciseId)}</span>
											<span class="plan-tune__diff-meta tabular-nums">
												{row.sets} × {row.reps}
											</span>
										</li>
									{/each}
									{#each diff.changed as change (change.after.exerciseId)}
										<li class="plan-tune__diff-row is-changed">
											<span class="plan-tune__diff-tag">{translate(lang, 'planTune.changed')}</span>
											<span class="plan-tune__diff-name">{nameOf(change.after.exerciseId)}</span>
											<span class="plan-tune__diff-meta tabular-nums">
												{change.before.sets} × {change.before.reps} → {change.after.sets} × {change.after
													.reps}
											</span>
										</li>
									{/each}
									{#if diff.reordered}
										<li class="plan-tune__diff-row is-order">
											<span class="plan-tune__diff-tag">{translate(lang, 'planTune.reordered')}</span>
										</li>
									{/if}
								</ul>
							{/if}

							<p class="plan-tune__result-meta">{metaText}</p>
						{/if}

						<div class="plan-tune__actions">
							{#if startBlocked}
								<p class="plan-tune__blocked">{translate(lang, 'planTune.activeSession')}</p>
							{/if}
							<MetalFx class="w-full">
								<AppButton
									variant="primary"
									block
									class="fx-cta-sheen"
									disabled={startBlocked}
									onclick={start}
								>
									{translate(lang, 'planTune.start')}
								</AppButton>
							</MetalFx>
							{#if !diff?.empty}
								<AppButton variant="secondary" block disabled={saving} onclick={save}>
									{translate(lang, 'planTune.saveToPlan')}
								</AppButton>
							{/if}
						</div>
						<button type="button" class="plan-tune__retry" onclick={() => (result = null)}>
							{translate(lang, 'planTune.retry')}
						</button>
					</div>
				{/if}
			</div>
		{/key}
	</div>
</BottomSheet>

<style>
	.plan-tune {
		margin-top: 0.75rem;
		/* Panes differ in height (form 355px vs result 400+px): clip the taller one
		   and glide the card between the two instead of snapping mid-swap. */
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		overflow: hidden;
		transition: height 0.32s var(--ease-snackbar);
	}

	.plan-tune__swap-pane {
		grid-area: 1 / 1;
		min-width: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.plan-tune {
			transition: none;
		}
	}

	:global(html[data-reduce-motion='true']) .plan-tune {
		transition: none;
	}

	.plan-tune__pane {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.plan-tune__lead {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.45;
		color: var(--color-muted);
	}

	.plan-tune__presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.plan-tune__preset {
		min-height: 2.25rem;
		padding: 0 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background: color-mix(in srgb, var(--color-surface) 80%, transparent);
		color: var(--color-ink);
		font-size: 0.8125rem;
		line-height: 1.2;
		cursor: pointer;
	}

	.plan-tune__preset.is-active {
		border-color: color-mix(in srgb, var(--color-accent) 60%, var(--color-border));
		background: color-mix(in srgb, var(--color-accent) 16%, var(--color-surface));
	}

	.plan-tune__preset:disabled {
		opacity: 0.5;
	}

	.plan-tune__field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}

	.plan-tune__label-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		min-width: 0;
	}

	.plan-tune__counter {
		flex: none;
		font-size: 0.6875rem;
		line-height: 1.2;
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}

	/* shadcn utilities keep the raw textarea at 48px, which clipped the wrapped
	   placeholder mid-second-line. Give it a real three-line box, let it grow to
	   ~six lines, then scroll — two selectors beat the utility classes. */
	:global(textarea.plan-tune__brief) {
		box-sizing: border-box;
		width: 100%;
		min-height: 5.5rem;
		max-height: 9.5rem;
		padding: 0.7rem 0.8rem;
		border-radius: var(--radius-control);
		font-size: 1rem;
		line-height: 1.45;
		resize: none;
		overflow-y: auto;
		field-sizing: content;
	}

	.plan-tune__hint,
	.plan-tune__error {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.4;
		color: var(--color-muted);
	}

	.plan-tune__error {
		color: var(--color-danger, #c44);
	}

	.plan-tune__cta {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.plan-tune__preview-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 650;
		color: var(--color-ink);
	}

	.plan-tune__summary {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--color-muted);
	}

	.plan-tune__diff {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-height: 12rem;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.plan-tune__diff-row {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		font-size: 0.8125rem;
		line-height: 1.35;
	}

	.plan-tune__diff-tag {
		flex: none;
		font-size: 0.6875rem;
		font-weight: 600;
		padding: 0 0.35rem;
		border-radius: 0.35rem;
		background: color-mix(in srgb, var(--color-border) 60%, transparent);
		color: var(--color-muted);
	}

	.plan-tune__diff-row.is-added .plan-tune__diff-tag {
		background: color-mix(in srgb, var(--color-accent) 22%, transparent);
		color: var(--color-accent-text);
	}

	.plan-tune__diff-row.is-removed .plan-tune__diff-name {
		text-decoration: line-through;
		color: var(--color-muted);
	}

	.plan-tune__diff-name {
		min-width: 0;
		color: var(--color-ink);
	}

	.plan-tune__diff-meta {
		margin-inline-start: auto;
		flex: none;
		color: var(--color-muted);
	}

	.plan-tune__result-meta {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-muted);
	}

	.plan-tune__actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.2rem;
	}

	.plan-tune__blocked {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--color-muted);
	}

	.plan-tune__retry {
		align-self: center;
		min-height: 2.75rem;
		padding: 0 0.6rem;
		border: none;
		background: none;
		color: var(--color-muted);
		font-size: 0.8125rem;
		cursor: pointer;
	}
</style>
