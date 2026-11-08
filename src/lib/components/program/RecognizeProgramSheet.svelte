<script lang="ts">
	import { goto } from '$app/navigation';
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { loadExerciseIndex } from '$lib/data/loadExercises';
	import type { ExerciseIndexItem } from '$lib/domain/types';
	import {
		matchRecognizedProgram,
		type RecognizedProgram
	} from '$lib/domain/recognizeProgram';
	import { createEmptyDraft } from '$lib/domain/workout';
	import { translate, translateError } from '$lib/i18n/messages';
	import { compressProgramImage } from '$lib/media/programImage';
	import { auth } from '$lib/stores/auth';
	import { draft } from '$lib/stores/draft';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { getSupabase } from '$lib/supabase/client';

	let {
		open = $bindable(false),
		onDismiss
	}: {
		open?: boolean;
		onDismiss?: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let user = $derived($auth.user);

	let fileInput = $state<HTMLInputElement | null>(null);
	let busy = $state(false);
	let phase = $state<'pick' | 'paywall' | 'review'>('pick');
	let errorKey = $state<string | null>(null);
	let program = $state<RecognizedProgram | null>(null);
	let catalog = $state<ExerciseIndexItem[]>([]);
	let overrides = $state<Record<string, string>>({});
	let proKnown = $state<boolean | null>(null);

	let matched = $derived(
		program && catalog.length
			? matchRecognizedProgram(program, catalog, overrides)
			: null
	);

	function reset() {
		busy = false;
		phase = 'pick';
		errorKey = null;
		program = null;
		overrides = {};
		if (fileInput) fileInput.value = '';
	}

	function dismiss() {
		reset();
		open = false;
		onDismiss?.();
	}

	function openPicker() {
		errorKey = null;
		fileInput?.click();
	}

	async function accessToken(): Promise<string | null> {
		const supabase = getSupabase();
		if (!supabase) return null;
		const {
			data: { session }
		} = await supabase.auth.getSession();
		return session?.access_token ?? null;
	}

	async function probePro(): Promise<boolean> {
		const token = await accessToken();
		if (!token) return false;
		try {
			const res = await fetch('/api/ai/recognize-plan', {
				headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
			});
			if (!res.ok) return false;
			const body = (await res.json()) as { pro?: boolean };
			return Boolean(body.pro);
		} catch {
			return false;
		}
	}

	async function onFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;

		errorKey = null;
		if (!user) {
			errorKey = 'recognize.needAuth';
			return;
		}

		busy = true;
		try {
			const isPro = proKnown ?? (await probePro());
			proKnown = isPro;
			if (!isPro) {
				phase = 'paywall';
				return;
			}

			const token = await accessToken();
			if (!token) {
				errorKey = 'recognize.needAuth';
				return;
			}

			const form = new FormData();
			const isImage =
				(file.type || '').startsWith('image/') ||
				/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name);
			if (isImage) {
				const compressed = await compressProgramImage(file);
				form.append('file', compressed.blob, compressed.filename);
			} else {
				form.append('file', file, file.name);
			}

			const res = await fetch('/api/ai/recognize-plan', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
				body: form
			});
			const body = (await res.json().catch(() => null)) as
				| { ok?: boolean; code?: string; error?: string; program?: RecognizedProgram }
				| null;

			if (res.status === 403 || body?.code === 'needPro') {
				proKnown = false;
				phase = 'paywall';
				return;
			}
			if (!res.ok || !body?.ok || !body.program) {
				const code = body?.code;
				errorKey =
					code === 'too_large'
						? 'recognize.tooLarge'
						: code === 'no_program'
							? 'recognize.noProgram'
							: code === 'needAuth'
								? 'recognize.needAuth'
								: code === 'unavailable'
									? 'recognize.unavailable'
									: code === 'invalid_file'
										? 'recognize.invalidFile'
										: 'recognize.fail';
				return;
			}

			catalog = await loadExerciseIndex();
			program = body.program;
			overrides = {};
			phase = 'review';
		} catch (err) {
			const msg = err instanceof Error ? err.message : '';
			errorKey =
				msg.startsWith('recognize.') || msg.startsWith('auth.') ? msg : 'recognize.fail';
		} finally {
			busy = false;
		}
	}

	function onOverrideChange(key: string, value: string) {
		overrides = { ...overrides, [key]: value };
	}

	function exerciseTitle(id: string): string {
		const ex = catalog.find((x) => x.id === id);
		if (!ex) return id;
		return lang === 'en' ? ex.name || ex.name_ru || id : ex.name_ru || ex.name;
	}

	function applyToBuilder() {
		if (!matched || matched.exercises.length === 0) {
			errorKey = 'recognize.noMatched';
			return;
		}
		const base = createEmptyDraft(matched.name);
		draft.loadPlanIntoDraft({
			...base,
			name: matched.name,
			exercises: matched.exercises.map((e) => ({
				exerciseId: e.exerciseId,
				sets: e.sets,
				reps: e.reps,
				restSec: e.restSec
			}))
		});
		toasts.show(translate(lang, 'recognize.addedToast'), 'success');
		dismiss();
		void goto('/builder');
	}
</script>

<input
	bind:this={fileInput}
	type="file"
	accept="image/*,.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
	capture="environment"
	class="sr-only"
	tabindex="-1"
	onchange={(e) => void onFileChange(e)}
/>

<BottomSheet
	bind:open
	titleId="recognize-program-title"
	dismissible={!busy}
	onDismiss={dismiss}
>
	<p id="recognize-program-title" class="bottom-sheet__title">
		{translate(
			lang,
			phase === 'paywall'
				? 'billing.paywallTitle'
				: phase === 'review'
					? 'recognize.reviewTitle'
					: 'recognize.title'
		)}
	</p>

	{#if phase === 'paywall'}
		<p class="bottom-sheet__hint">{translate(lang, 'billing.paywallLead')}</p>
	{:else if phase === 'review' && matched && program}
		<p class="bottom-sheet__hint">
			{translate(lang, 'recognize.preview', {
				n: program.rows.length,
				matched: matched.exercises.length,
				unmatched: matched.unmatched.length
			})}
		</p>
		<ul class="mt-2 flex list-none flex-col gap-2 p-0">
			{#each matched.exercises as ex (ex.exerciseId)}
				<li class="text-sm">
					<span class="font-semibold">{exerciseTitle(ex.exerciseId)}</span>
					<span class="text-[var(--color-muted)]">
						{' '}{ex.sets}×{ex.reps}
						{#if ex.restSec > 0}
							· {ex.restSec}s
						{/if}
					</span>
				</li>
			{/each}
		</ul>
		{#if matched.unmatched.length > 0}
			<p class="bottom-sheet__hint mt-3">
				{translate(lang, 'recognize.reviewUnmatched', { n: matched.unmatched.length })}
			</p>
			<ul class="mt-2 flex list-none flex-col gap-2 p-0">
				{#each matched.unmatched as row (row.key)}
					<li class="flex flex-col gap-1">
						<span class="text-sm font-semibold">{row.name}</span>
						<select
							class="min-h-[48px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm"
							value={overrides[row.key] ?? ''}
							disabled={busy}
							onchange={(e) => onOverrideChange(row.key, e.currentTarget.value)}
						>
							<option value="">{translate(lang, 'recognize.skipRow')}</option>
							{#each row.candidates as candidate (candidate.id)}
								<option value={candidate.id}>
									{lang === 'en'
										? candidate.name
										: candidate.name_ru || candidate.name}
								</option>
							{/each}
						</select>
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<p class="bottom-sheet__hint">{translate(lang, 'recognize.lead')}</p>
		{#if busy}
			<div class="mt-3 flex items-center gap-2" aria-live="polite">
				<Spinner size="sm" block={false} />
				<span class="text-sm">{translate(lang, 'recognize.working')}</span>
			</div>
		{/if}
	{/if}

	{#if errorKey}
		<p class="bottom-sheet__hint text-[var(--color-danger)]" role="alert">
			{translateError(lang, errorKey)}
		</p>
	{/if}

	{#snippet actions()}
		<AppButton variant="secondary" disabled={busy} onclick={dismiss}>
			{translate(lang, 'common.cancel')}
		</AppButton>
		{#if phase === 'paywall'}
			<AppButton href="/auth#pro" disabled={busy}>
				{translate(lang, 'billing.subscribe')}
			</AppButton>
		{:else if phase === 'review'}
			<AppButton
				disabled={busy || !matched || matched.exercises.length === 0}
				onclick={applyToBuilder}
			>
				{translate(lang, 'recognize.openBuilder')}
			</AppButton>
		{:else}
			<AppButton disabled={busy} aria-busy={busy} onclick={openPicker}>
				{translate(lang, 'recognize.pickFile')}
			</AppButton>
		{/if}
	{/snippet}
</BottomSheet>
