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
	import { Mic, MicOff, RefreshCw, Sparkles, X } from '@lucide/svelte';
	import { onMount, tick } from 'svelte';
	import type { Snapshot } from './$types';
	import '$lib/styles/blocks/ai-draft.css';

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

	type AiDraftSnap = {
		brief: string;
		plan: PlanPayload | null;
		planMeta: { provider: string; model: string; dropped: number } | null;
	};

	const AI_DRAFT_SESSION_KEY = 'repdraft:ai-draft:v1';
	const AI_DRAFT_SESSION_LEGACY = 'repdraft:lab-ai:v1';

	function readAiDraftSession(): AiDraftSnap | null {
		if (!browser) return null;
		try {
			const raw =
				sessionStorage.getItem(AI_DRAFT_SESSION_KEY) ??
				sessionStorage.getItem(AI_DRAFT_SESSION_LEGACY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as AiDraftSnap;
			if (typeof parsed?.brief !== 'string') return null;
			return parsed;
		} catch {
			return null;
		}
	}

	function writeAiDraftSession(snap: AiDraftSnap): void {
		if (!browser) return;
		try {
			sessionStorage.setItem(AI_DRAFT_SESSION_KEY, JSON.stringify(snap));
			sessionStorage.removeItem(AI_DRAFT_SESSION_LEGACY);
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
	let title = $derived(translate(lang, 'aiDraft.title'));

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
	let dictationGen = 0;
	let sessionReady = $state(false);

	$effect(() => {
		if (!sessionReady) return;
		writeAiDraftSession({ brief, plan, planMeta });
	});

	export const snapshot: Snapshot<AiDraftSnap> = {
		capture: () => ({ brief, plan, planMeta }),
		restore: (value) => {
			brief = value.brief;
			plan = value.plan;
			planMeta = value.planMeta;
			writeAiDraftSession(value);
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
		dictationGen += 1;
		dictationSession?.stop();
		dictationSession = null;
		listening = false;
	}

	function focusBrief() {
		if (!browser) return;
		const el = document.getElementById('ai-draft-brief') as HTMLTextAreaElement | null;
		el?.focus();
	}

	function clearBrief() {
		stopDictation();
		brief = '';
		plan = null;
		planMeta = null;
		fieldError = null;
		void tick().then(focusBrief);
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
					? translate(lang, 'aiDraft.dictateInsecure')
					: translate(lang, 'aiDraft.dictateUnsupported'),
				'info'
			);
			return;
		}
		fieldError = null;
		const gen = ++dictationGen;
		listening = true;
		const session = await startSpeechDictation({
			lang: speechLangFromLocale(lang),
			onInterim: (text) => {
				if (gen !== dictationGen) return;
				brief = text.slice(0, AI_BRIEF_MAX);
			},
			onFinal: (text) => {
				if (gen !== dictationGen) return;
				brief = text.slice(0, AI_BRIEF_MAX);
			},
			onError: (code) => {
				if (gen !== dictationGen) return;
				listening = false;
				dictationSession = null;
				if (code === 'aborted' || code === 'no-speech') {
					fieldError = null;
					return;
				}
				if (code === 'not-allowed' || code === 'service-not-allowed') {
					fieldError = translate(lang, 'aiDraft.dictateDenied');
					focusBrief();
					return;
				}
				if (code === 'unavailable') {
					fieldError = translate(lang, 'aiDraft.dictateUnavailable');
					focusBrief();
					return;
				}
				if (code === 'insecure') {
					fieldError = translate(lang, 'aiDraft.dictateInsecure');
					focusBrief();
					return;
				}
				if (code === 'unsupported') {
					fieldError = translate(lang, 'aiDraft.dictateUnsupported');
					focusBrief();
					return;
				}
				fieldError = translate(lang, 'aiDraft.dictateError');
			},
			onEnd: () => {
				if (gen !== dictationGen) return;
				listening = false;
				dictationSession = null;
			}
		});
		if (gen !== dictationGen) {
			session?.stop();
			return;
		}
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
				return translate(lang, 'aiDraft.unavailable');
			case 'invalid_brief':
				return translate(lang, 'aiDraft.emptyBrief');
			case 'invalid_plan':
				return err.error || translate(lang, 'aiDraft.generateFailed');
			case 'upstream':
			default:
				return translate(lang, 'aiDraft.upstreamError');
		}
	}

	onMount(() => {
		if (!sessionReady) {
			const snap = readAiDraftSession();
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
			fieldError = translate(lang, 'aiDraft.unavailable');
			return;
		}
		const text = sanitizeAiBrief(brief);
		if (!text) {
			fieldError = translate(lang, 'aiDraft.emptyBrief');
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
				.getElementById('ai-draft-plan')
				?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
		} catch {
			available = false;
			fieldError = translate(lang, 'aiDraft.unavailable');
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
		toasts.show(translate(lang, 'aiDraft.addedToast'), 'success');
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

<div class="content-page content-page--narrow ai-draft-page">
	<ScreenHeader {title} backHref="/workouts" preferHistoryBack />

	{#if checking}
		<div class="ai-draft-page__checking" aria-live="polite">
			<Spinner label={translate(lang, 'aiDraft.providerChecking')} size="sm" />
		</div>
	{:else if blocked}
		<EmptyState
			centered
			title={translate(lang, 'aiDraft.unavailable')}
			description={translate(lang, 'aiDraft.lead')}
			actionHref="/workouts"
			actionLabel={translate(lang, 'aiDraft.back')}
		/>
	{:else}
		<div class="ai-draft-page__ai-bar" class:ai-draft-page__ai-bar--compact={Boolean(plan)} aria-live="polite">
			<span class="ai-draft-page__ai-badge">
				<LucideIcon icon={Sparkles} size={ICON_SMALL} />
				{plan ? translate(lang, 'aiDraft.cueShort') : translate(lang, 'aiDraft.cue')}
			</span>
			{#if available && providerName}
				<span class="ai-draft-page__provider" translate="no">
					{providerName === 'gigachat' ? 'GigaChat' : providerName}
				</span>
			{/if}
		</div>

		<section class="ai-draft-page__examples" aria-label={translate(lang, 'aiDraft.examplesTitle')}>
			<div class="catalog-filter-chips ai-draft-page__chips">
				{#each EXAMPLES as ex (ex.key)}
					<button
						type="button"
						class="catalog-filter-chip ai-draft-page__chip"
						class:is-active={brief.trim() === exampleBrief(ex, lang)}
						onclick={() => applyExample(exampleBrief(ex, lang))}
					>
						{exampleLabel(ex, lang)}
					</button>
				{/each}
			</div>
		</section>

		<form
			class="ai-draft-page__form"
			onsubmit={(e) => {
				e.preventDefault();
				void generate();
			}}
		>
			<div class="ai-draft-page__field">
				<div class="ai-draft-page__label-row">
					<AppLabel for="ai-draft-brief">{translate(lang, 'aiDraft.briefLabel')}</AppLabel>
					<span class="ai-draft-page__counter" aria-hidden="true"
						>{translate(lang, 'aiDraft.chars', { n: String(charCount) })}</span
					>
				</div>
				<div
					class="ai-draft-page__composer"
					class:ai-draft-page__composer--listening={listening}
					class:ai-draft-page__composer--has-clear={brief.length > 0}
				>
					<AppTextarea
						id="ai-draft-brief"
						class="pr-note-field ai-draft-page__brief"
						name="brief"
						autocomplete="off"
						bind:value={brief}
						rows={1}
						maxlength={AI_BRIEF_MAX}
						disabled={busy}
						placeholder={translate(lang, 'aiDraft.briefPlaceholder')}
						aria-invalid={fieldError ? 'true' : undefined}
						aria-describedby={fieldError
							? 'ai-draft-error'
							: plan || listening
								? undefined
								: 'ai-draft-hint'}
						onkeydown={onKeydown}
						onfocus={onBriefFocus}
					/>
					{#if brief.length > 0}
						<button
							type="button"
							class="ai-draft-page__clear"
							disabled={busy}
							aria-label={translate(lang, 'a11y.clearField')}
							title={translate(lang, 'a11y.clearField')}
							onclick={clearBrief}
						>
							<LucideIcon icon={X} size={ICON_SMALL} />
						</button>
					{/if}
					<button
						type="button"
						class="ai-draft-page__mic"
						class:ai-draft-page__mic--active={listening}
						disabled={busy}
						aria-pressed={listening}
						aria-label={listening
							? translate(lang, 'aiDraft.dictateStop')
							: translate(lang, 'aiDraft.dictate')}
						onclick={() => void toggleDictation()}
					>
						<LucideIcon icon={listening ? MicOff : Mic} size={ICON_BUTTON} />
					</button>
				</div>
				{#if listening}
					<p class="ai-draft-page__listening" aria-live="polite">{translate(lang, 'aiDraft.listening')}</p>
				{:else if !plan}
					<p id="ai-draft-hint" class="ai-draft-page__hint">{translate(lang, 'aiDraft.briefHint')}</p>
				{/if}
				{#if fieldError}
					<p id="ai-draft-error" class="ai-draft-page__error" role="alert">{fieldError}</p>
				{/if}
			</div>

			{#if plan}
				<AppButton type="submit" variant="secondary" block disabled={busy || !brief.trim()}>
					{#if !busy}
						<LucideIcon icon={RefreshCw} size={ICON_BUTTON} />
					{/if}
					{busy ? translate(lang, 'aiDraft.generating') : translate(lang, 'aiDraft.regenerate')}
				</AppButton>
			{:else}
				<AppButton type="submit" variant="primary" block disabled={busy || !brief.trim()}>
					{#if !busy}
						<LucideIcon icon={Sparkles} size={ICON_BUTTON} />
					{/if}
					{busy ? translate(lang, 'aiDraft.generating') : translate(lang, 'aiDraft.generate')}
				</AppButton>
			{/if}
		</form>

		{#if busy}
			<div
				class="ai-draft-page__skeleton"
				aria-busy="true"
				aria-live="polite"
				aria-label={translate(lang, 'aiDraft.generating')}
			>
				<div class="ai-draft-page__skeleton-line ai-draft-page__skeleton-line--title"></div>
				<div class="ai-draft-page__skeleton-line ai-draft-page__skeleton-line--meta"></div>
				{#each [0, 1, 2, 3, 4] as row (row)}
					<div class="ai-draft-page__skeleton-line ai-draft-page__skeleton-line--row"></div>
				{/each}
			</div>
		{:else if plan}
			<section id="ai-draft-plan" class="ai-draft-page__plan panel" aria-live="polite">
				<div class="ai-draft-page__plan-head">
					<h2 class="ai-draft-page__plan-title">{plan.name}</h2>
					<p class="ai-draft-page__plan-meta">
						{translate(lang, 'aiDraft.planSummary', {
							min: String(planMinutes),
							n: String(plan.exercises.length)
						})}
					</p>
					{#if planMeta && planMeta.dropped > 0}
						<p class="ai-draft-page__plan-meta-sub">
							{translate(lang, 'aiDraft.dropped', { n: String(planMeta.dropped) })}
						</p>
					{/if}
				</div>
				<ol class="ai-draft-page__list">
					{#each plan.exercises as ex, i (ex.exerciseId + i)}
						{@const meta = exerciseMeta(ex.exerciseId)}
						<li class="ai-draft-page__exercise">
							<span class="ai-draft-page__exercise-num" aria-hidden="true">{i + 1}</span>
							<div class="ai-draft-page__exercise-body">
								<a
									class="ai-draft-page__exercise-title"
									href={withFromParam(`/exercise/${ex.exerciseId}`, '/ai')}
									aria-label={translate(lang, 'aiDraft.openExercise', {
										name: meta?.title ?? ex.exerciseId
									})}
								>
									{meta?.title ?? ex.exerciseId}
								</a>
								<div class="ai-draft-page__exercise-meta">
									{#if meta?.targetLabel}
										<span class="ai-draft-page__exercise-badge">{meta.targetLabel}</span>
									{/if}
									<span class="ai-draft-page__exercise-spec"
										>{translate(lang, 'aiDraft.exerciseSpec', {
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
				<div class="ai-draft-page__plan-actions">
					<AppButton type="button" variant="primary" block onclick={applyToDraft}>
						{translate(lang, 'aiDraft.addToBuilder')}
					</AppButton>
				</div>
			</section>
		{/if}
	{/if}
</div>
