<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppLabel from '$lib/components/AppLabel.svelte';
	import AppTextarea from '$lib/components/AppTextarea.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import {
		speechDictationBlockReason,
		speechDictationSupported,
		speechLangFromLocale,
		startSpeechDictation,
		type DictationSession
	} from '$lib/browser/speechDictation';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import { createEmptyDraft } from '$lib/domain/workout';
	import { labelTarget } from '$lib/domain/labels.ru';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { draft } from '$lib/stores/draft';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { scrollFieldIntoView } from '$lib/dom/scrollFieldIntoView';
	import { AI_BRIEF_MAX, sanitizeAiBrief } from '$lib/domain/inputLimits';
	import { withFromParam } from '$lib/domain/navigation';
	import { Mic, MicOff, RefreshCw, Sparkles } from '@lucide/svelte';
	import { onMount, tick } from 'svelte';
	import type { Snapshot } from './$types';
	import '$lib/styles/blocks/lab-ai.css';

	type PlanExercise = {
		exerciseId: string;
		sets: number;
		reps: number;
		restSec: number;
	};

	type PlanPayload = {
		name: string;
		exercises: PlanExercise[];
	};

	type LabAiSnap = {
		brief: string;
		plan: PlanPayload | null;
		planMeta: { provider: string; model: string; dropped: number } | null;
	};

	const LAB_AI_SESSION_KEY = 'repdraft:lab-ai:v1';

	function readLabAiSession(): LabAiSnap | null {
		if (!browser) return null;
		try {
			const raw = sessionStorage.getItem(LAB_AI_SESSION_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as LabAiSnap;
			if (typeof parsed?.brief !== 'string') return null;
			return parsed;
		} catch {
			return null;
		}
	}

	function writeLabAiSession(snap: LabAiSnap): void {
		if (!browser) return;
		try {
			sessionStorage.setItem(LAB_AI_SESSION_KEY, JSON.stringify(snap));
		} catch {
			/* quota / private mode */
		}
	}

	type GenerateOk = {
		ok: true;
		provider: string;
		model: string;
		plan: PlanPayload;
		droppedUnknownIds: number;
	};

	type GenerateErr = {
		ok: false;
		code: 'unavailable' | 'invalid_brief' | 'invalid_plan' | 'upstream';
		error?: string;
	};

	type IndexItem = {
		id: string;
		name: string;
		name_ru?: string;
		target: string;
	};

	type Example = {
		key: string;
		labelRu: string;
		labelEn: string;
		briefRu: string;
		briefEn: string;
	};

	const EXAMPLES: Example[] = [
		{
			key: 'fullbody',
			labelRu: 'Всё тело',
			labelEn: 'Full body',
			briefRu: 'всё тело, 60 минут, смешанное оборудование',
			briefEn: 'full body, 60 minutes, mixed equipment'
		},
		{
			key: 'upper',
			labelRu: 'Верх',
			labelEn: 'Upper body',
			briefRu: 'верх тела, 55 минут, штанга и гантели',
			briefEn: 'upper body, 55 minutes, barbell and dumbbells'
		},
		{
			key: 'lower',
			labelRu: 'Низ',
			labelEn: 'Lower body',
			briefRu: 'низ тела, 55 минут, штанга и тренажёры',
			briefEn: 'lower body, 55 minutes, barbell and machines'
		},
		{
			key: 'chestTri',
			labelRu: 'Грудь + трицепс',
			labelEn: 'Chest + triceps',
			briefRu: 'грудь и трицепс, 45 минут, штанга и гантели',
			briefEn: 'chest and triceps, 45 minutes, barbell and dumbbells'
		},
		{
			key: 'backBi',
			labelRu: 'Спина + бицепс',
			labelEn: 'Back + biceps',
			briefRu: 'спина и бицепс, 50 минут, штанга и тяга',
			briefEn: 'back and biceps, 50 minutes, barbell and rows'
		},
		{
			key: 'legs',
			labelRu: 'Ноги',
			labelEn: 'Legs',
			briefRu: 'ноги, 60 минут, штанга и тренажёры',
			briefEn: 'legs, 60 minutes, barbell and machines'
		},
		{
			key: 'shoulders',
			labelRu: 'Плечи',
			labelEn: 'Shoulders',
			briefRu: 'плечи, 40 минут, гантели и кабель',
			briefEn: 'shoulders, 40 minutes, dumbbells and cable'
		}
	];

	function exampleLabel(ex: Example, locale: AppLocale): string {
		return locale === 'en' ? ex.labelEn : ex.labelRu;
	}

	function exampleBrief(ex: Example, locale: AppLocale): string {
		return locale === 'en' ? ex.briefEn : ex.briefRu;
	}

	let lang = $derived($resolvedLocale);
	let title = $derived(translate(lang, 'labAi.title'));

	// Empty on SSR; session/snapshot restore on client (avoids hydration mismatch).
	let brief = $state('');
	let busy = $state(false);
	let offline = $state(false);
	let available = $state<boolean | null>(null);
	let providerName = $state<string | null>(null);
	let fieldError = $state<string | null>(null);
	let plan = $state<PlanPayload | null>(null);
	let planMeta = $state<{ provider: string; model: string; dropped: number } | null>(null);
	let index = $state<IndexItem[]>([]);
	let dictationOk = $state(false);
	let dictationBlock = $state<'insecure' | 'unsupported' | null>(null);
	let listening = $state(false);
	let dictationSession: DictationSession | null = null;
	let sessionReady = $state(false);

	$effect(() => {
		if (!sessionReady) return;
		writeLabAiSession({ brief, plan, planMeta });
	});

	export const snapshot: Snapshot<LabAiSnap> = {
		capture: () => ({ brief, plan, planMeta }),
		restore: (value) => {
			brief = value.brief;
			plan = value.plan;
			planMeta = value.planMeta;
			writeLabAiSession(value);
			sessionReady = true;
		}
	};

	function refreshOnline() {
		offline = browser ? !navigator.onLine : false;
	}

	async function checkAvailability() {
		refreshOnline();
		if (offline) {
			available = false;
			providerName = null;
			return;
		}
		try {
			const res = await fetch('/api/ai/plan');
			const data = (await res.json()) as { available?: boolean; provider?: string };
			available = Boolean(data.available);
			providerName = data.provider ?? null;
		} catch {
			available = false;
			providerName = null;
		}
	}

	function stopDictation() {
		dictationSession?.stop();
		dictationSession = null;
		listening = false;
	}

	function focusBrief() {
		if (!browser) return;
		const el = document.getElementById('lab-ai-brief') as HTMLTextAreaElement | null;
		el?.focus();
	}

	function onBriefFocus(e: FocusEvent) {
		const el = e.currentTarget;
		if (el instanceof HTMLElement) scrollFieldIntoView(el);
	}

	async function toggleDictation() {
		if (listening) {
			stopDictation();
			return;
		}
		if (!dictationOk) {
			fieldError = null;
			focusBrief();
			toasts.show(
				dictationBlock === 'insecure'
					? translate(lang, 'labAi.dictateInsecure')
					: translate(lang, 'labAi.dictateUnsupported'),
				'info'
			);
			return;
		}
		fieldError = null;
		listening = true;
		const session = await startSpeechDictation({
			lang: speechLangFromLocale(lang),
			onInterim: (text) => {
				brief = text;
			},
			onFinal: (text) => {
				brief = text.slice(0, AI_BRIEF_MAX);
			},
			onError: (code) => {
				if (code === 'aborted' || code === 'no-speech') return;
				listening = false;
				dictationSession = null;
				if (code === 'not-allowed' || code === 'service-not-allowed') {
					fieldError = translate(lang, 'labAi.dictateDenied');
					focusBrief();
					return;
				}
				fieldError = translate(lang, 'labAi.dictateError');
			},
			onEnd: () => {
				listening = false;
				dictationSession = null;
			}
		});
		if (!session) {
			listening = false;
			return;
		}
		dictationSession = session;
	}

	function applyExample(text: string) {
		brief = text;
		fieldError = null;
		focusBrief();
	}

	function localizeError(err: GenerateErr): string {
		switch (err.code) {
			case 'unavailable':
				return translate(lang, 'labAi.unavailable');
			case 'invalid_brief':
				return translate(lang, 'labAi.emptyBrief');
			case 'invalid_plan':
				return err.error || translate(lang, 'labAi.generateFailed');
			case 'upstream':
			default:
				return translate(lang, 'labAi.upstreamError');
		}
	}

	onMount(() => {
		if (!sessionReady) {
			const snap = readLabAiSession();
			if (snap && (snap.brief || snap.plan)) {
				brief = snap.brief;
				plan = snap.plan;
				planMeta = snap.planMeta;
			}
			sessionReady = true;
		}
		dictationOk = speechDictationSupported();
		dictationBlock = speechDictationBlockReason();
		refreshOnline();
		void checkAvailability();
		const onOnline = () => void checkAvailability();
		const onOffline = () => {
			offline = true;
			available = false;
			stopDictation();
		};
		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);
		void loadExerciseIndex()
			.then((idx) => {
				index = idx.map((ex) => ({
					id: ex.id,
					name: ex.name,
					name_ru: ex.name_ru,
					target: ex.target
				}));
			})
			.catch(() => {
				/* labels optional */
			});
		return () => {
			stopDictation();
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
		};
	});

	async function generate() {
		stopDictation();
		fieldError = null;
		plan = null;
		planMeta = null;
		refreshOnline();
		if (offline || available === false) {
			fieldError = translate(lang, 'labAi.unavailable');
			return;
		}
		const text = sanitizeAiBrief(brief);
		if (!text) {
			fieldError = translate(lang, 'labAi.emptyBrief');
			await tick();
			focusBrief();
			return;
		}
		brief = text;
		busy = true;
		try {
			const res = await fetch('/api/ai/plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({ brief: text })
			});
			const data = (await res.json()) as GenerateOk | GenerateErr;
			if (!res.ok || !data.ok) {
				const err = data as GenerateErr;
				if (err.code === 'unavailable') available = false;
				fieldError = localizeError(err);
				return;
			}
			const ok = data as GenerateOk;
			plan = ok.plan;
			planMeta = {
				provider: ok.provider,
				model: ok.model,
				dropped: ok.droppedUnknownIds
			};
			await tick();
			const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			document
				.getElementById('lab-ai-plan')
				?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
		} catch {
			available = false;
			fieldError = translate(lang, 'labAi.unavailable');
		} finally {
			busy = false;
		}
	}

	function applyToDraft() {
		if (!plan) return;
		const base = createEmptyDraft(plan.name);
		draft.loadPlanIntoDraft({
			...base,
			name: plan.name,
			exercises: plan.exercises.map((e) => ({
				exerciseId: e.exerciseId,
				sets: e.sets,
				reps: e.reps,
				restSec: e.restSec
			}))
		});
		toasts.show(translate(lang, 'labAi.addedToast'), 'success');
		void goto('/builder');
	}

	function exerciseMeta(id: string): { title: string; targetLabel: string } | null {
		const ex = index.find((x) => x.id === id);
		if (!ex) return null;
		const title = lang === 'en' ? ex.name || ex.name_ru || id : ex.name_ru || ex.name;
		return { title, targetLabel: labelTarget(ex.target, lang) };
	}

	/** Rough session length: work (~3s/rep) + rests between sets. */
	function estimatePlanMinutes(exercises: PlanExercise[]): number {
		let sec = 0;
		for (const e of exercises) {
			const workPerSet = Math.min(60, Math.max(20, e.reps * 3));
			sec += e.sets * workPerSet + Math.max(0, e.sets - 1) * e.restSec;
		}
		return Math.max(1, Math.round(sec / 60));
	}

	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !busy && brief.trim()) {
			e.preventDefault();
			void generate();
		}
	}

	let checking = $derived(available === null && !offline);
	let blocked = $derived(offline || available === false);
	let charCount = $derived(brief.length);
	let planMinutes = $derived(plan ? estimatePlanMinutes(plan.exercises) : 0);
</script>

<SeoHead {title} noindex />

<div class="content-page content-page--catalog lab-ai-page">
	<ScreenHeader {title} backHref="/auth" preferHistoryBack={false} />

	{#if checking}
		<div class="lab-ai-page__checking" aria-live="polite">
			<Spinner label={translate(lang, 'labAi.providerChecking')} size="sm" />
		</div>
	{:else if blocked}
		<EmptyState
			centered
			title={translate(lang, 'labAi.unavailable')}
			description={translate(lang, 'labAi.lead')}
			actionHref="/auth"
			actionLabel={translate(lang, 'labAi.back')}
		/>
	{:else}
		<div class="lab-ai-page__ai-bar" class:lab-ai-page__ai-bar--compact={Boolean(plan)} aria-live="polite">
			<span class="lab-ai-page__ai-badge">
				<LucideIcon icon={Sparkles} size={ICON_SMALL} />
				{plan ? translate(lang, 'labAi.cueShort') : translate(lang, 'labAi.cue')}
			</span>
			{#if available && providerName}
				<span class="lab-ai-page__provider" translate="no">
					{providerName === 'gigachat' ? 'GigaChat' : providerName}
				</span>
			{/if}
		</div>

		<section class="lab-ai-page__examples" aria-label={translate(lang, 'labAi.examplesTitle')}>
			<div class="catalog-filter-chips lab-ai-page__chips">
				{#each EXAMPLES as ex (ex.key)}
					<button
						type="button"
						class="catalog-filter-chip lab-ai-page__chip"
						class:is-active={brief.trim() === exampleBrief(ex, lang)}
						onclick={() => applyExample(exampleBrief(ex, lang))}
					>
						{exampleLabel(ex, lang)}
					</button>
				{/each}
			</div>
		</section>

		<form
			class="lab-ai-page__form"
			onsubmit={(e) => {
				e.preventDefault();
				void generate();
			}}
		>
			<div class="lab-ai-page__field">
				<div class="lab-ai-page__label-row">
					<AppLabel for="lab-ai-brief">{translate(lang, 'labAi.briefLabel')}</AppLabel>
					<span class="lab-ai-page__counter" aria-hidden="true"
						>{translate(lang, 'labAi.chars', { n: String(charCount) })}</span
					>
				</div>
				<div class="lab-ai-page__composer" class:lab-ai-page__composer--listening={listening}>
					<AppTextarea
						id="lab-ai-brief"
						class="pr-note-field lab-ai-page__brief"
						name="brief"
						autocomplete="off"
						bind:value={brief}
						rows={1}
						maxlength={AI_BRIEF_MAX}
						disabled={busy}
						placeholder={translate(lang, 'labAi.briefPlaceholder')}
						aria-invalid={fieldError ? 'true' : undefined}
						aria-describedby={fieldError
							? 'lab-ai-error'
							: plan || listening
								? undefined
								: 'lab-ai-hint'}
						onkeydown={onKeydown}
						onfocus={onBriefFocus}
					/>
					<button
						type="button"
						class="lab-ai-page__mic"
						class:lab-ai-page__mic--active={listening}
						disabled={busy}
						aria-pressed={listening}
						aria-label={listening
							? translate(lang, 'labAi.dictateStop')
							: translate(lang, 'labAi.dictate')}
						onclick={() => void toggleDictation()}
					>
						<LucideIcon icon={listening ? MicOff : Mic} size={ICON_BUTTON} />
					</button>
				</div>
				{#if listening}
					<p class="lab-ai-page__listening" aria-live="polite">{translate(lang, 'labAi.listening')}</p>
				{:else if !plan}
					<p id="lab-ai-hint" class="lab-ai-page__hint">{translate(lang, 'labAi.briefHint')}</p>
				{/if}
				{#if fieldError}
					<p id="lab-ai-error" class="lab-ai-page__error" role="alert">{fieldError}</p>
				{/if}
			</div>

			{#if plan}
				<AppButton type="submit" variant="secondary" block disabled={busy || !brief.trim()}>
					{#if !busy}
						<LucideIcon icon={RefreshCw} size={ICON_BUTTON} />
					{/if}
					{busy ? translate(lang, 'labAi.generating') : translate(lang, 'labAi.regenerate')}
				</AppButton>
			{:else}
				<AppButton type="submit" variant="primary" block disabled={busy || !brief.trim()}>
					{#if !busy}
						<LucideIcon icon={Sparkles} size={ICON_BUTTON} />
					{/if}
					{busy ? translate(lang, 'labAi.generating') : translate(lang, 'labAi.generate')}
				</AppButton>
			{/if}
		</form>

		{#if busy}
			<div
				class="lab-ai-page__skeleton"
				aria-busy="true"
				aria-live="polite"
				aria-label={translate(lang, 'labAi.generating')}
			>
				<div class="lab-ai-page__skeleton-line lab-ai-page__skeleton-line--title"></div>
				<div class="lab-ai-page__skeleton-line lab-ai-page__skeleton-line--meta"></div>
				{#each [0, 1, 2, 3, 4] as row (row)}
					<div class="lab-ai-page__skeleton-line lab-ai-page__skeleton-line--row"></div>
				{/each}
			</div>
		{:else if plan}
			<section id="lab-ai-plan" class="lab-ai-page__plan panel" aria-live="polite">
				<div class="lab-ai-page__plan-head">
					<h2 class="lab-ai-page__plan-title">{plan.name}</h2>
					<p class="lab-ai-page__plan-meta">
						{translate(lang, 'labAi.planSummary', {
							min: String(planMinutes),
							n: String(plan.exercises.length)
						})}
					</p>
					{#if planMeta && planMeta.dropped > 0}
						<p class="lab-ai-page__plan-meta-sub">
							{translate(lang, 'labAi.dropped', { n: String(planMeta.dropped) })}
						</p>
					{/if}
				</div>
				<ol class="lab-ai-page__list">
					{#each plan.exercises as ex, i (ex.exerciseId + i)}
						{@const meta = exerciseMeta(ex.exerciseId)}
						<li class="lab-ai-page__exercise">
							<span class="lab-ai-page__exercise-num" aria-hidden="true">{i + 1}</span>
							<div class="lab-ai-page__exercise-body">
								<a
									class="lab-ai-page__exercise-title"
									href={withFromParam(`/exercise/${ex.exerciseId}`, '/lab/ai')}
									aria-label={translate(lang, 'labAi.openExercise', {
										name: meta?.title ?? ex.exerciseId
									})}
								>
									{meta?.title ?? ex.exerciseId}
								</a>
								<div class="lab-ai-page__exercise-meta">
									{#if meta?.targetLabel}
										<span class="lab-ai-page__exercise-badge">{meta.targetLabel}</span>
									{/if}
									<span class="lab-ai-page__exercise-spec"
										>{translate(lang, 'labAi.exerciseSpec', {
											sets: String(ex.sets),
											reps: String(ex.reps),
											rest: String(ex.restSec)
										})}</span
									>
								</div>
							</div>
						</li>
					{/each}
				</ol>
				<div class="lab-ai-page__plan-actions">
					<AppButton type="button" variant="primary" block onclick={applyToDraft}>
						{translate(lang, 'labAi.addToBuilder')}
					</AppButton>
				</div>
			</section>
		{/if}
	{/if}
</div>
