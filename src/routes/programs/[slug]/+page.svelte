<script lang="ts">
	import '$lib/styles/blocks/programs.css';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import AppButton from '$lib/components/AppButton.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import JsonLd from '$lib/seo/JsonLd.svelte';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { buildBreadcrumbJsonLd, buildProgramJsonLd } from '$lib/seo/jsonLd';
	import { resolveSeoLang } from '$lib/seo/seoLang';
	import { resolveSiteOrigin } from '$lib/seo/site';
	import { enPath, ruEnAlternates } from '$lib/seo/alternates';
	import type { AppLocale } from '$lib/i18n/locale';
	import { loadExerciseIndexWithCustoms } from '$lib/data/exerciseIndexWithCustoms';
	import {
		PROGRAMS_HUB_PATH,
		buildSessionExercises,
		findProgram,
		isSlotDone,
		isSlotStarted,
		programLead,
		programPath,
		programProgressView,
		programShortName,
		programTitle,
		programWeeks,
		sessionPrescription,
		sessionTitle,
		sessionSlotKey,
		type ProgramSessionTemplate
	} from '$lib/domain/programs';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import { translate } from '$lib/i18n/messages';
	import { readActiveSession } from '$lib/storage/localSessionRepository';
	import { live } from '$lib/stores/live';
	import { plans } from '$lib/stores/plans';
	import { programs } from '$lib/stores/programs';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';

	/** `/en/programs/[slug]` mirror passes an explicit locale + canonical path. */
	let {
		localeOverride = null,
		pathOverride = null
	}: { localeOverride?: AppLocale | null; pathOverride?: string | null } = $props();

	let program = $derived(findProgram($page.params.slug ?? ''));
	let PATH = $derived(program ? programPath(program.slug) : PROGRAMS_HUB_PATH);
	let pagePath = $derived(pathOverride ?? PATH);
	let hubHref = $derived(localeOverride === 'en' ? enPath(PROGRAMS_HUB_PATH) : PROGRAMS_HUB_PATH);

	let lang = $derived<AppLocale>(localeOverride ?? $resolvedLocale);
	let seoLang = $derived<AppLocale>(localeOverride ?? resolveSeoLang($page.data.seoLocale, lang));
	let origin = $derived(resolveSiteOrigin($page.url.origin));

	let runs = $derived($programs);
	let run = $derived(program ? (runs[program.slug] ?? null) : null);
	let progress = $derived(program ? programProgressView(program, run) : null);
	let finishedPlanIds = $derived(
		new Set(
			$live.history
				.filter((session) => session.finishedAt && session.planId)
				.map((session) => session.planId as string)
		)
	);

	let index = $state<ExerciseIndexItem[]>([]);
	let startingKey = $state<string | null>(null);

	let jsonLd = $derived(
		program
			? [
					buildProgramJsonLd(origin, {
						path: pagePath,
						title: programTitle(program, seoLang),
						description: programLead(program, seoLang),
						locale: seoLang,
						weeks: program.weeks
					}),
					buildBreadcrumbJsonLd(origin, [
						{ name: translate(seoLang, 'nav.tabHome'), path: '/' },
						{ name: translate(seoLang, 'programs.title'), path: hubHref },
						{ name: programTitle(program, seoLang), path: pagePath }
					])
				]
			: []
	);

	$effect(() => {
		// `run` is a dependency: hydration happens after mount, and the effect must
		// re-check completion once the local slots are actually loaded.
		if (!program || !run || finishedPlanIds.size === 0) return;
		programs.syncFinished(program.slug, finishedPlanIds);
	});

	function slotKey(week: number, sessionId: string) {
		return sessionSlotKey(week, sessionId);
	}

	function slotPlanId(week: number, sessionId: string): string | null {
		return run?.slots[slotKey(week, sessionId)]?.planId ?? null;
	}

	async function startSession(week: number, session: ProgramSessionTemplate) {
		if (!program || startingKey) return;
		const key = slotKey(week, session.id);
		const active = readActiveSession();
		if (active && !active.finishedAt) {
			toasts.show(translate(lang, 'programs.activeSession'), 'error');
			return;
		}
		startingKey = key;
		try {
			// A tap can beat the catalog fetch on a slow phone: load it here instead
			// of failing the one action the page exists for.
			const catalog = index.length > 0 ? index : await loadExerciseIndexWithCustoms();
			if (catalog.length === 0) {
				toasts.show(translate(lang, 'programs.startFail'), 'error');
				return;
			}
			index = catalog;
			const prescription = sessionPrescription(session, week);
			const exercises = buildSessionExercises({ session, prescription, catalog });
			if (exercises.length === 0) {
				toasts.show(translate(lang, 'programs.startFail'), 'error');
				return;
			}
			// Kept under `PLAN_NAME_MAX` (48): short program name + week + session.
			const name = `${programShortName(program, lang)} · ${translate(lang, 'programs.weekShort', {
				n: week
			})} · ${sessionTitle(session, lang)}`;
			const { plan } = await plans.importPlan({ name, exercises });
			programs.startSlot(program.slug, week, session.id, plan.id);
			await live.startFromPlan(plan, { lockPrescription: true });
			await goto(`/live/${plan.id}`);
		} catch {
			toasts.show(translate(lang, 'programs.startFail'), 'error');
		} finally {
			startingKey = null;
		}
	}

	onMount(() => {
		programs.hydrate();
		void (async () => {
			const [loaded] = await Promise.all([loadExerciseIndexWithCustoms(), live.refreshHistory()]);
			index = loaded;
		})();
	});
</script>

<SeoHead
	title={program ? programTitle(program, seoLang) : translate(seoLang, 'programs.title')}
	description={program ? programLead(program, seoLang) : ''}
	path={pagePath}
	locale={seoLang}
	alternates={program ? ruEnAlternates(PATH) : []}
	noindex={!program}
/>
<JsonLd data={jsonLd} />

<div class="content-page programs-page">
	<ScreenHeader
		title={program ? programTitle(program, lang) : translate(lang, 'programs.title')}
		backHref={hubHref}
		backLabel={translate(lang, 'programs.title')}
		backLabelVisible
	/>

	{#if !program}
		<p class="program-note">{translate(lang, 'programs.missing')}</p>
	{:else}
		<header class="program-head">
			<div class="program-tags">
				<span class="program-tag">
					{translate(
						lang,
						program.level === 'novice' ? 'programs.levelNovice' : 'programs.levelIntermediate'
					)}
				</span>
				<span class="program-tag">{translate(lang, 'programs.weeks', { n: program.weeks })}</span>
				<span class="program-tag">
					{translate(lang, 'programs.sessionsPerWeek', { n: program.sessions.length })}
				</span>
			</div>
			<p class="program-head__lead">{programLead(program, lang)}</p>
		</header>

		{#if progress}
			<div class="program-progress">
				<div class="program-progress__row">
					<span>{translate(lang, 'programs.progress', { done: progress.done, total: progress.total })}</span>
					<span>{progress.percent}%</span>
				</div>
				<div
					class="program-progress__bar"
					role="progressbar"
					aria-valuenow={progress.done}
					aria-valuemin={0}
					aria-valuemax={progress.total}
				>
					<div class="program-progress__fill" style="width: {progress.percent}%"></div>
				</div>
			</div>
		{/if}

		<section class="program-weeks" aria-label={translate(lang, 'programs.weeksTitle')}>
			{#each programWeeks(program) as week (week.index)}
				<div class="program-week">
					<h2 class="program-week__title">
						{translate(lang, 'programs.weekTitle', { n: week.index })}
					</h2>
					<div class="program-week__rows">
						{#each week.sessions as session (session.id)}
							{@const key = slotKey(week.index, session.id)}
							{@const prescription = sessionPrescription(session, week.index)}
							{@const done = isSlotDone(run, week.index, session.id)}
							{@const started = isSlotStarted(run, week.index, session.id)}
							<div class="program-session" class:is-done={done}>
								<div class="program-session__main">
									<p class="program-session__title">{sessionTitle(session, lang)}</p>
									<p class="program-session__meta">
										{translate(lang, 'programs.prescription', {
											sets: prescription.sets,
											reps: prescription.reps,
											rest: prescription.restSec
										})}
									</p>
								</div>
								<div class="program-session__actions">
									{#if done}
										<span class="program-session__done">
											{translate(lang, 'programs.done')}
										</span>
									{:else}
										{#if started}
											{@const planId = slotPlanId(week.index, session.id)}
											{#if planId}
												<a class="program-session__link" href={`/workouts/${planId}`}>
													{translate(lang, 'programs.openPlan')}
												</a>
											{/if}
										{/if}
										<AppButton
											variant="secondary"
											size="sm"
											disabled={startingKey !== null}
											aria-busy={startingKey === key}
											onclick={() => void startSession(week.index, session)}
										>
											{startingKey === key
												? translate(lang, 'programs.starting')
												: translate(lang, 'programs.start')}
										</AppButton>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</section>

		<section class="program-how">
			<h2 class="program-section-title">{translate(lang, 'programs.howTitle')}</h2>
			<p class="program-hint">{translate(lang, 'programs.how1')}</p>
			<p class="program-hint">{translate(lang, 'programs.how2')}</p>
			<p class="program-hint">{translate(lang, 'programs.how3')}</p>
			<p class="program-note">{translate(lang, 'programs.note')}</p>
		</section>
	{/if}
</div>
