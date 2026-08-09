<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import {
		labelBodyPart,
		labelEquipment,
		labelTarget
	} from '$lib/domain/labels.ru';
	import { exerciseName } from '$lib/domain/exerciseName';
	import { translate } from '$lib/i18n/messages';
	import { draft } from '$lib/stores/draft';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import PersonalRecordPanel from '$lib/components/PersonalRecordPanel.svelte';
	import TechniqueClipsPanel from '$lib/components/TechniqueClipsPanel.svelte';

	let { data } = $props();

	let exercise = $derived(data.exercise);
	let lang = $derived($resolvedLocale);
	let title = $derived(exercise ? exerciseName(exercise, lang) : '');
	let steps = $derived.by(() => {
		if (!exercise) return [] as string[];
		const map = exercise.instruction_steps ?? {};
		return map[lang] ?? map.ru ?? map.en ?? [];
	});
	let mediaOpen = $state(false);
	let mediaCloseBtn: HTMLButtonElement | undefined = $state();

	function addToDraft() {
		if (!exercise) return;
		const result = draft.addToDraft(exercise.id);
		if (result.added) {
			toasts.show(translate(lang, 'exercise.added'), 'success');
		} else {
			toasts.show(translate(lang, 'exercise.already'), 'info');
		}
	}

	function openMedia() {
		mediaOpen = true;
	}

	function closeMedia() {
		mediaOpen = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && mediaOpen) closeMedia();
	}

	$effect(() => {
		if (!mediaOpen) return;
		queueMicrotask(() => mediaCloseBtn?.focus());
	});

	$effect(() => {
		if (typeof document === 'undefined' || !mediaOpen) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	});
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>{exercise ? `${title} — Repdraft` : `${translate(lang, 'exercise.notFoundTitle')} — Repdraft`}</title>
</svelte:head>

{#if !exercise}
	<EmptyState
		title={translate(lang, 'exercise.notFoundTitle')}
		description={translate(lang, 'exercise.notFoundDesc')}
		actionHref="/"
		actionLabel={translate(lang, 'builder.toCatalog')}
	/>
{:else}
	<article class="grid min-w-0 gap-5 pb-mobile-actions lg:grid-cols-[280px_1fr] lg:gap-6 lg:pb-0">
		<div class="min-w-0">
			<a href="/" class="mb-3 inline-flex text-sm font-medium text-[var(--color-accent)] md:hidden"
				>{translate(lang, 'exercise.back')}</a
			>
			<button
				type="button"
				class="panel relative flex w-full cursor-zoom-in items-center justify-center overflow-hidden !p-4 sm:!p-5 lg:!p-3"
				aria-label={translate(lang, 'exercise.openMedia')}
				onclick={openMedia}
			>
				<img
					src={`/${exercise.gif_url}`}
					alt={title}
					width="180"
					height="180"
					fetchpriority="high"
					decoding="async"
					class="pointer-events-none block h-[180px] w-[180px] max-w-full object-contain"
				/>
				<span
					class="pointer-events-none absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] text-[var(--color-muted)] shadow-sm backdrop-blur-[2px]"
					aria-hidden="true"
				>
					<svg
						viewBox="0 0 24 24"
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-width="1.9"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="10.5" cy="10.5" r="5.5" />
						<path d="M15.5 15.5 20 20" />
					</svg>
				</span>
			</button>
		</div>

		<div class="flex min-w-0 flex-col gap-4 md:gap-6">
			<div>
				<p class="text-sm text-[var(--color-muted)]">{labelBodyPart(exercise.body_part, lang)}</p>
				<h1 class="page-title">{title}</h1>
			</div>

			<dl class="panel grid gap-3 !p-3 text-sm sm:grid-cols-2">
				<div>
					<dt class="text-[var(--color-muted)]">{translate(lang, 'exercise.equipment')}</dt>
					<dd class="font-medium">{labelEquipment(exercise.equipment, lang)}</dd>
				</div>
				<div>
					<dt class="text-[var(--color-muted)]">{translate(lang, 'exercise.target')}</dt>
					<dd class="font-medium">{labelTarget(exercise.target, lang)}</dd>
				</div>
				<div class="sm:col-span-2">
					<dt class="text-[var(--color-muted)]">{translate(lang, 'exercise.secondary')}</dt>
					<dd class="font-medium">
						{#if exercise.secondary_muscles.length}
							{exercise.secondary_muscles.map((m) => labelTarget(m, lang)).join(', ')}
						{:else}
							{translate(lang, 'exercise.dash')}
						{/if}
					</dd>
				</div>
			</dl>

			<div class="actions-inline">
				<button type="button" class="btn-primary" onclick={addToDraft}
					>{translate(lang, 'exercise.addDraft')}</button
				>
			</div>

			<section>
				<h2 class="section-title mb-2">{translate(lang, 'exercise.howTo')}</h2>
				<ol class="list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-[var(--color-ink)]">
					{#each steps as step, i (i)}
						<li>{step}</li>
					{/each}
				</ol>
			</section>

			<PersonalRecordPanel exerciseId={exercise.id} />

			<TechniqueClipsPanel exerciseId={exercise.id} />
		</div>
	</article>

	<div class="sticky-actions">
		<div class="mx-auto max-w-6xl">
			<button type="button" class="btn-primary btn-block" onclick={addToDraft}
				>{translate(lang, 'exercise.toDraft')}</button
			>
		</div>
	</div>

	{#if mediaOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 pb-[calc(var(--safe-bottom)+1rem)]"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			aria-label={title}
			onclick={(e) => {
				if (e.target === e.currentTarget) closeMedia();
			}}
		>
			<div class="flex w-full max-w-lg flex-col items-center gap-3">
				<img
					src={`/${exercise.gif_url}`}
					alt={title}
					width="180"
					height="180"
					decoding="async"
					class="aspect-square w-[min(100%,22rem)] max-h-[min(80vh,28rem)] rounded-[var(--radius-panel)] bg-[var(--color-surface)] object-contain shadow-xl"
				/>
				<button
					type="button"
					class="btn-secondary"
					bind:this={mediaCloseBtn}
					onclick={closeMedia}
				>
					{translate(lang, 'exercise.closeMedia')}
				</button>
			</div>
		</div>
	{/if}
{/if}
