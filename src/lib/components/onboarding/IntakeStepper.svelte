<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import AppIconButton from '$lib/components/AppIconButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import {
		ATHLETE_DAYS_OPTIONS,
		ATHLETE_EXPERIENCE_IDS,
		ATHLETE_GOAL_IDS,
		ATHLETE_LIMIT_IDS,
		ATHLETE_SESSION_MINUTES_OPTIONS,
		defaultAthleteProfile,
		intakeStepsForPlace,
		markIntakeComplete,
		skipIntakeProfile,
		toggleAthleteGoal,
		toggleAthleteLimit,
		type AthleteExperience,
		type AthleteGoalId,
		type AthleteLimitId,
		type AthleteProfile,
		type IntakeStepId,
		type TrainingPlace
	} from '$lib/domain/athleteProfile';
	import {
		HOME_KIT_OPTIONAL_GROUPS,
		type HomeKitOptionalId
	} from '$lib/domain/homeKit';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { athleteProfile, homeKitSelection } from '$lib/stores/prefs';
	import { ArrowLeft, Check, X } from 'phosphor-svelte';

	let {
		open = $bindable(false),
		/** first: skip writes default gym profile; edit: skip only closes. */
		mode = 'first',
		onFinished
	}: {
		open?: boolean;
		mode?: 'first' | 'edit';
		onFinished?: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let draft = $state<AthleteProfile>(defaultAthleteProfile());
	let kitDraft = $state<HomeKitOptionalId[]>([]);
	let stepIndex = $state(0);
	let heightText = $state('');
	let weightText = $state('');
	let wasOpen = $state(false);

	let steps = $derived(intakeStepsForPlace(draft.trainingPlace));
	let step = $derived(steps[Math.min(stepIndex, steps.length - 1)] ?? 'goals');
	let isLast = $derived(stepIndex >= steps.length - 1);
	let progressPct = $derived(Math.round(((stepIndex + 1) / Math.max(steps.length, 1)) * 100));

	$effect(() => {
		if (open && !wasOpen) {
			const current = $athleteProfile;
			draft = { ...current, intakeCompletedAt: null };
			kitDraft = [...$homeKitSelection];
			heightText = current.heightCm != null ? String(current.heightCm) : '';
			weightText = current.weightKg != null ? String(current.weightKg) : '';
			stepIndex = 0;
		}
		wasOpen = open;
	});

	$effect(() => {
		const nextSteps = intakeStepsForPlace(draft.trainingPlace);
		if (stepIndex > nextSteps.length - 1) stepIndex = nextSteps.length - 1;
	});

	function parseOptionalInt(raw: string, min: number, max: number): number | null {
		const t = raw.trim();
		if (!t) return null;
		const n = Math.round(Number(t.replace(',', '.')));
		if (!Number.isFinite(n) || n < min || n > max) return null;
		return n;
	}

	function applyBodyFields(profile: AthleteProfile): AthleteProfile {
		return {
			...profile,
			heightCm: parseOptionalInt(heightText, 100, 250),
			weightKg: parseOptionalInt(weightText, 30, 300)
		};
	}

	function finish(profile: AthleteProfile) {
		const next = markIntakeComplete(applyBodyFields(profile));
		if (next.trainingPlace === 'home') {
			homeKitSelection.set(kitDraft);
		}
		athleteProfile.set(next);
		open = false;
		onFinished?.();
	}

	function skip() {
		if (mode === 'first') {
			athleteProfile.set(skipIntakeProfile());
		}
		open = false;
		onFinished?.();
	}

	function goNext() {
		if (isLast) {
			finish(draft);
			return;
		}
		stepIndex += 1;
	}

	function goBack() {
		if (stepIndex <= 0) return;
		stepIndex -= 1;
	}

	function setPlace(place: TrainingPlace) {
		draft = { ...draft, trainingPlace: place };
	}

	function setExperience(experience: AthleteExperience) {
		draft = { ...draft, experience };
	}

	function setDays(days: number) {
		draft = { ...draft, daysPerWeek: days };
	}

	function setMinutes(minutes: number) {
		draft = { ...draft, sessionMinutes: minutes };
	}

	function toggleGoal(id: AthleteGoalId) {
		draft = { ...draft, goals: toggleAthleteGoal(draft.goals, id) };
	}

	function toggleLimit(id: AthleteLimitId) {
		draft = { ...draft, limits: toggleAthleteLimit(draft.limits, id) };
	}

	function toggleKit(id: HomeKitOptionalId) {
		kitDraft = kitDraft.includes(id)
			? kitDraft.filter((g) => g !== id)
			: [...kitDraft, id];
	}

	function stepTitle(id: IntakeStepId): string {
		switch (id) {
			case 'goals':
				return translate(lang, 'intake.goalsTitle');
			case 'place':
				return translate(lang, 'intake.placeTitle');
			case 'kit':
				return translate(lang, 'intake.kitTitle');
			case 'body':
				return translate(lang, 'intake.bodyTitle');
			case 'rhythm':
				return translate(lang, 'intake.rhythmTitle');
			case 'limits':
				return translate(lang, 'intake.limitsTitle');
			default: {
				const _exhaustive: never = id;
				return _exhaustive;
			}
		}
	}

	function stepHint(id: IntakeStepId): string {
		switch (id) {
			case 'goals':
				return translate(lang, 'intake.goalsHint');
			case 'place':
				return translate(lang, 'intake.placeHint');
			case 'kit':
				return translate(lang, 'intake.kitHint');
			case 'body':
				return translate(lang, 'intake.bodyHint');
			case 'rhythm':
				return translate(lang, 'intake.rhythmHint');
			case 'limits':
				return translate(lang, 'intake.limitsHint');
			default: {
				const _exhaustive: never = id;
				return _exhaustive;
			}
		}
	}
</script>

{#snippet optionRow(label: string, active: boolean, onclick: () => void, radio = false)}
	<button
		type="button"
		class="intake-option"
		class:is-active={active}
		role={radio ? 'radio' : 'checkbox'}
		aria-checked={active}
		{onclick}
	>
		<span class="intake-option__label">{label}</span>
		{#if active}
			<span class="intake-option__check" aria-hidden="true">
				<LucideIcon icon={Check} size={ICON_SMALL} />
			</span>
		{/if}
	</button>
{/snippet}

{#if open}
	<BottomSheet
		{open}
		raised
		dismissible={false}
		titleId="intake-stepper-title"
		onDismiss={skip}
	>
		<div class="intake-stepper">
			<header class="intake-stepper__head">
				<div class="intake-stepper__toolbar">
					{#if stepIndex > 0}
						<AppIconButton
							type="button"
							class="intake-stepper__tool-btn"
							aria-label={translate(lang, 'intake.back')}
							onclick={goBack}
						>
							<LucideIcon icon={ArrowLeft} size={ICON_PRIMARY} />
						</AppIconButton>
					{:else}
						<span class="intake-stepper__tool-slot" aria-hidden="true"></span>
					{/if}
					<p class="intake-stepper__step-label">
						{translate(lang, 'intake.stepProgress', {
							current: stepIndex + 1,
							total: steps.length
						})}
					</p>
					<AppIconButton
						type="button"
						class="intake-stepper__tool-btn intake-stepper__tool-btn--end"
						aria-label={translate(lang, 'intake.skip')}
						onclick={skip}
					>
						<LucideIcon icon={X} size={ICON_PRIMARY} />
					</AppIconButton>
				</div>
				<div
					class="intake-stepper__progress"
					role="progressbar"
					aria-valuemin={1}
					aria-valuemax={steps.length}
					aria-valuenow={stepIndex + 1}
					aria-label={translate(lang, 'intake.title')}
				>
					<span class="intake-stepper__progress-fill" style={`width: ${progressPct}%`}></span>
				</div>
				<h2 id="intake-stepper-title" class="intake-stepper__title">
					{stepTitle(step)}
				</h2>
				<p class="intake-stepper__hint">{stepHint(step)}</p>
			</header>

			<div class="intake-stepper__body">
				{#if step === 'goals'}
					<div class="intake-stepper__options" role="group" aria-label={stepTitle('goals')}>
						{#each ATHLETE_GOAL_IDS as id (id)}
							{@render optionRow(
								translate(lang, `intake.goal.${id}`),
								draft.goals.includes(id),
								() => toggleGoal(id)
							)}
						{/each}
					</div>
				{:else if step === 'place'}
					<div class="intake-stepper__options" role="radiogroup" aria-label={stepTitle('place')}>
						{@render optionRow(
							translate(lang, 'place.gym'),
							draft.trainingPlace === 'gym',
							() => setPlace('gym'),
							true
						)}
						{@render optionRow(
							translate(lang, 'place.home'),
							draft.trainingPlace === 'home',
							() => setPlace('home'),
							true
						)}
					</div>
				{:else if step === 'kit'}
					<div class="intake-stepper__list" role="group" aria-label={stepTitle('kit')}>
						<div class="intake-stepper__row intake-stepper__row--locked">
							<span class="intake-stepper__row-label intake-stepper__row-label--muted">
								{translate(lang, 'homeKit.group.bodyweight')}
							</span>
							<input
								type="checkbox"
								class="auth-pref-toggle__input"
								checked
								disabled
								tabindex="-1"
								aria-label={translate(lang, 'homeKit.bodyweightAlways')}
							/>
						</div>
						{#each HOME_KIT_OPTIONAL_GROUPS as id (id)}
							<label class="intake-stepper__row">
								<span class="intake-stepper__row-label"
									>{translate(lang, `homeKit.group.${id}`)}</span
								>
								<input
									type="checkbox"
									class="auth-pref-toggle__input"
									checked={kitDraft.includes(id)}
									onchange={() => toggleKit(id)}
								/>
							</label>
						{/each}
					</div>
				{:else if step === 'body'}
					<div class="intake-stepper__fields">
						<label class="intake-stepper__field">
							<span>{translate(lang, 'intake.height')}</span>
							<input
								class="intake-stepper__input"
								type="text"
								inputmode="numeric"
								autocomplete="off"
								placeholder="-"
								bind:value={heightText}
							/>
						</label>
						<label class="intake-stepper__field">
							<span>{translate(lang, 'intake.weight')}</span>
							<input
								class="intake-stepper__input"
								type="text"
								inputmode="decimal"
								autocomplete="off"
								placeholder="-"
								bind:value={weightText}
							/>
						</label>
					</div>
				{:else if step === 'rhythm'}
					<section class="intake-stepper__section">
						<p class="intake-stepper__sub">{translate(lang, 'intake.rhythmTitle')}</p>
						<div
							class="intake-stepper__options"
							role="radiogroup"
							aria-label={translate(lang, 'intake.rhythmTitle')}
						>
							{#each ATHLETE_EXPERIENCE_IDS as id (id)}
								{@render optionRow(
									translate(lang, `intake.experience.${id}`),
									draft.experience === id,
									() => setExperience(id),
									true
								)}
							{/each}
						</div>
					</section>
					<section class="intake-stepper__section">
						<p class="intake-stepper__sub">{translate(lang, 'intake.days')}</p>
						<div class="intake-stepper__grid" role="radiogroup" aria-label={translate(lang, 'intake.days')}>
							{#each ATHLETE_DAYS_OPTIONS as n (n)}
								<button
									type="button"
									class="intake-grid-cell"
									class:is-active={draft.daysPerWeek === n}
									role="radio"
									aria-checked={draft.daysPerWeek === n}
									onclick={() => setDays(n)}
								>
									{n}
								</button>
							{/each}
						</div>
					</section>
					<section class="intake-stepper__section">
						<p class="intake-stepper__sub">{translate(lang, 'intake.minutes')}</p>
						<div
							class="intake-stepper__grid"
							role="radiogroup"
							aria-label={translate(lang, 'intake.minutes')}
						>
							{#each ATHLETE_SESSION_MINUTES_OPTIONS as n (n)}
								<button
									type="button"
									class="intake-grid-cell"
									class:is-active={draft.sessionMinutes === n}
									role="radio"
									aria-checked={draft.sessionMinutes === n}
									onclick={() => setMinutes(n)}
								>
									{n}
								</button>
							{/each}
						</div>
					</section>
				{:else if step === 'limits'}
					<div class="intake-stepper__options" role="group" aria-label={stepTitle('limits')}>
						{#each ATHLETE_LIMIT_IDS as id (id)}
							{@render optionRow(
								translate(lang, `intake.limit.${id}`),
								draft.limits.includes(id),
								() => toggleLimit(id)
							)}
						{/each}
					</div>
				{/if}
			</div>
		</div>

		{#snippet actions()}
			<AppButton type="button" variant="primary" block onclick={goNext}>
				{isLast ? translate(lang, 'intake.finish') : translate(lang, 'intake.next')}
			</AppButton>
		{/snippet}
	</BottomSheet>
{/if}

<style>
	.intake-stepper {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
		width: 100%;
		padding: 0.15rem 0.15rem 0.35rem;
	}

	.intake-stepper__head {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.intake-stepper__toolbar {
		display: grid;
		grid-template-columns: 3rem 1fr 3rem;
		align-items: center;
		gap: 0.35rem;
		min-height: 48px;
	}

	.intake-stepper__tool-slot {
		display: block;
		width: 48px;
		height: 48px;
	}

	:global(.intake-stepper__tool-btn) {
		justify-self: start;
	}

	:global(.intake-stepper__tool-btn--end) {
		justify-self: end;
	}

	.intake-stepper__step-label {
		margin: 0;
		text-align: center;
		font-size: 0.8125rem;
		font-weight: 650;
		letter-spacing: 0.02em;
		color: var(--color-muted);
	}

	.intake-stepper__title {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 750;
		line-height: 1.25;
		color: var(--color-text);
	}

	.intake-stepper__hint {
		margin: 0;
		color: var(--color-muted);
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.intake-stepper__progress {
		height: 4px;
		border-radius: 999px;
		background: var(--color-border);
		overflow: hidden;
	}

	.intake-stepper__progress-fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--color-accent);
		transition: width 180ms ease;
	}

	.intake-stepper__body {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		min-width: 0;
		max-height: min(52dvh, 380px);
		overflow-x: hidden;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		scrollbar-width: none;
	}

	.intake-stepper__body::-webkit-scrollbar {
		display: none;
	}

	.intake-stepper__options {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.intake-stepper__section {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.intake-stepper__sub {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 650;
		color: var(--color-muted);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	:global(.intake-option) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		min-height: 48px;
		min-width: 48px;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-control);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.95rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 140ms ease,
			background 140ms ease,
			color 140ms ease;
	}

	:global(.intake-option:hover) {
		border-color: color-mix(in srgb, var(--color-accent) 35%, var(--color-border));
	}

	:global(.intake-option:focus-visible) {
		outline: none;
		box-shadow: var(--focus-ring);
	}

	:global(.intake-option.is-active) {
		border-color: var(--color-accent);
		background: var(--color-accent-muted);
		color: var(--color-accent-text);
		font-weight: 650;
	}

	:global(.intake-option__label) {
		flex: 1 1 auto;
		min-width: 0;
	}

	:global(.intake-option__check) {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--color-accent-text);
	}

	.intake-stepper__grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.4rem;
	}

	.intake-grid-cell {
		min-height: 48px;
		min-width: 48px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-control);
		background: var(--color-surface);
		color: var(--color-text);
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
	}

	.intake-grid-cell.is-active {
		border-color: var(--color-accent);
		background: var(--color-accent-muted);
		color: var(--color-accent-text);
	}

	.intake-grid-cell:focus-visible {
		outline: none;
		box-shadow: var(--focus-ring);
	}

	.intake-stepper__list {
		display: flex;
		flex-direction: column;
	}

	.intake-stepper__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 48px;
		cursor: pointer;
	}

	.intake-stepper__row--locked {
		cursor: default;
		opacity: 0.72;
		margin-bottom: 0.25rem;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid var(--color-border);
	}

	.intake-stepper__row-label {
		font-size: 0.95rem;
		color: var(--color-text);
	}

	.intake-stepper__row-label--muted {
		color: var(--color-muted);
	}

	.intake-stepper__fields {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		width: 100%;
		max-width: 100%;
		min-width: 0;
	}

	.intake-stepper__field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-muted);
	}

	.intake-stepper__input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: 48px;
		border-radius: var(--radius-control);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		padding: 0 0.85rem;
		font-size: 1.05rem;
		font-weight: 600;
	}

</style>
