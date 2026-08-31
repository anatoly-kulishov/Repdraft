<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON, ICON_SMALL } from '$lib/components/icons/sizes';
	import {
		ONBOARDING_CHECKLIST_STEPS,
		checklistProgress,
		type OnboardingChecklistStep
	} from '$lib/domain/onboarding';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { onboarding } from '$lib/stores/onboarding';
	import { BookOpen, ChevronRight, Circle, CircleCheck, Play, X } from '@lucide/svelte';

	let {
		onTryDemo,
		demoBusy = false,
		readonly = false,
		articlesHref = undefined
	}: {
		onTryDemo: () => void | Promise<void>;
		demoBusy?: boolean;
		readonly?: boolean;
		articlesHref?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
	let state = $derived($onboarding);
	let progress = $derived(checklistProgress(state));
	let progressPct = $derived(
		progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
	);

	const stepLabelKey: Record<OnboardingChecklistStep, string> = {
		homeSeen: 'onboarding.stepHome',
		planReady: 'onboarding.stepPlan',
		liveEntered: 'onboarding.stepLive',
		setLogged: 'onboarding.stepSet',
		sessionFinished: 'onboarding.stepFinish'
	};
</script>

<AppPanel class="onboarding-checklist">
	<div class="onboarding-checklist__head">
		<div class="onboarding-checklist__intro min-w-0">
			<p class="onboarding-checklist__kicker">{translate(lang, 'onboarding.checklistKicker')}</p>
			<h2 class="onboarding-checklist__title">
				{translate(
					lang,
					readonly ? 'onboarding.checklistReplayTitle' : 'onboarding.checklistTitle'
				)}
			</h2>
			<p class="onboarding-checklist__meta">
				{translate(lang, 'onboarding.checklistProgress', {
					done: String(progress.done),
					total: String(progress.total)
				})}
			</p>
		</div>
		{#if !readonly}
			<AppButton
				variant="ghost"
				class="onboarding-checklist__dismiss"
				onclick={() => onboarding.dismissChecklist()}
				aria-label={translate(lang, 'a11y.close')}
			>
				<LucideIcon icon={X} size={ICON_SMALL} />
			</AppButton>
		{/if}
		<div
			class="onboarding-checklist__progress"
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={progress.total}
			aria-valuenow={progress.done}
			aria-label={translate(lang, 'onboarding.checklistProgress', {
				done: String(progress.done),
				total: String(progress.total)
			})}
		>
			<span class="onboarding-checklist__progress-fill" style={`width: ${progressPct}%`}></span>
		</div>
	</div>

	<ul class="onboarding-checklist__steps">
		{#each ONBOARDING_CHECKLIST_STEPS as step (step)}
			<li class="onboarding-checklist__step" class:is-done={state.checklist[step]}>
				<span class="onboarding-checklist__icon" aria-hidden="true">
					<LucideIcon icon={state.checklist[step] ? CircleCheck : Circle} size={ICON_SMALL} />
				</span>
				<span class="onboarding-checklist__label">{translate(lang, stepLabelKey[step])}</span>
			</li>
		{/each}
	</ul>

	{#if !readonly}
		<div class="onboarding-checklist__actions">
			<AppButton
				variant="secondary"
				block
				class="onboarding-checklist__demo"
				disabled={demoBusy}
				aria-busy={demoBusy}
				onclick={() => void onTryDemo()}
			>
				<span class="inline-flex items-center justify-center gap-2">
					<LucideIcon icon={Play} size={ICON_BUTTON} />
					{translate(lang, 'onboarding.tryDemo')}
				</span>
			</AppButton>
			{#if articlesHref}
				<a class="onboarding-checklist__articles" href={articlesHref}>
					<span class="onboarding-checklist__articles-icon" aria-hidden="true">
						<LucideIcon icon={BookOpen} size={ICON_SMALL} />
					</span>
					<span class="onboarding-checklist__articles-copy min-w-0">
						<span class="onboarding-checklist__articles-title">
							{translate(lang, 'articles.homeTeaserTitle')}
						</span>
						<span class="onboarding-checklist__articles-lead">
							{translate(lang, 'onboarding.gettingStartedLead')}
						</span>
					</span>
					<LucideIcon icon={ChevronRight} size={ICON_SMALL} class="onboarding-checklist__articles-chevron" />
				</a>
			{/if}
		</div>
	{/if}
</AppPanel>
