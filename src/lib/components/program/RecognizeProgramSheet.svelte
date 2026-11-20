<script lang="ts">
	import { goto } from '$app/navigation';
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { MetalFx, ThinkingOrbs } from '$lib/components/fx';

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
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { Camera, FileXls } from 'phosphor-svelte';

	let {
		open = $bindable(false),
		onDismiss
	}: {
		open?: boolean;
		onDismiss?: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let user = $derived($auth.user);

	let photoInput = $state<HTMLInputElement | null>(null);
	let tableInput = $state<HTMLInputElement | null>(null);
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
		if (photoInput) photoInput.value = '';
		if (tableInput) tableInput.value = '';
	}

	function dismiss() {
		reset();
		open = false;
		onDismiss?.();
	}

	function openPhotoPicker() {
		errorKey = null;
		photoInput?.click();
	}

	function openTablePicker() {
		errorKey = null;
		tableInput?.click();
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

	async function onFileChange(e: Event, kind: 'photo' | 'table') {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;

		errorKey = null;
		if (!user) {
			errorKey = 'recognize.needAuth';
			return;
		}

		const isImage =
			(file.type || '').startsWith('image/') ||
			/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name);
		const isTable =
			/\.(xlsx|xls|csv)$/i.test(file.name) ||
			(file.type || '').includes('sheet') ||
			(file.type || '').includes('excel') ||
			(file.type || '').includes('csv') ||
			(file.type || '') === 'text/plain';

		if (kind === 'photo' && !isImage) {
			errorKey = 'recognize.invalidFile';
			return;
		}
		if (kind === 'table' && !isTable) {
			errorKey = 'recognize.invalidFile';
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

<!-- No capture= : that forces the camera on phones and blocks Excel. -->
<input
	bind:this={photoInput}
	type="file"
	accept="image/*,image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic"
	class="sr-only"
	tabindex="-1"
	onchange={(e) => void onFileChange(e, 'photo')}
/>
<input
	bind:this={tableInput}
	type="file"
	accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/comma-separated-values"
	class="sr-only"
	tabindex="-1"
	onchange={(e) => void onFileChange(e, 'table')}
/>

<BottomSheet
	bind:open
	flush
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
			<div class="recognize-working" aria-live="polite" aria-busy="true">
				<ThinkingOrbs
					mode="searching"
					size={64}
					label={translate(lang, 'recognize.working')}
				/>
				<span class="text-sm">{translate(lang, 'recognize.working')}</span>
			</div>
		{:else}
			<div class="recognize-pick-actions">
				<MetalFx class="w-full">
					<AppButton
						variant="primary"
						block
						disabled={busy}
						aria-busy={busy}
						class="fx-cta-sheen"
						onclick={openPhotoPicker}
					>
						<LucideIcon icon={Camera} size={ICON_SMALL} />
						{translate(lang, 'recognize.pickPhoto')}
					</AppButton>
				</MetalFx>
				<AppButton
					variant="ghost"
					block
					class="recognize-pick-outline"
					disabled={busy}
					aria-busy={busy}
					onclick={openTablePicker}
				>
					<LucideIcon icon={FileXls} size={ICON_SMALL} />
					{translate(lang, 'recognize.pickSpreadsheet')}
				</AppButton>
			</div>
		{/if}
	{/if}

	{#if errorKey}
		<p class="bottom-sheet__hint text-[var(--color-danger)]" role="alert">
			{translateError(lang, errorKey)}
		</p>
	{/if}

	{#if phase === 'pick' && !busy}
		<div class="recognize-cancel">
			<span class="recognize-cancel__rule" aria-hidden="true"></span>
			<button type="button" class="recognize-cancel__button" onclick={dismiss}>
				{translate(lang, 'common.cancel')}
			</button>
		</div>
	{/if}

	{#snippet actions()}
		{#if phase !== 'pick'}
			<AppButton variant="secondary" disabled={busy} onclick={dismiss}>
				{translate(lang, 'common.cancel')}
			</AppButton>
		{/if}
		{#if phase === 'paywall'}
			<AppButton href="/auth/pro" disabled={busy}>
				{translate(lang, 'billing.subscribe')}
			</AppButton>
		{:else if phase === 'review'}
			<MetalFx>
				<AppButton
					disabled={busy || !matched || matched.exercises.length === 0}
					class="fx-cta-sheen"
					onclick={applyToBuilder}
				>
					{translate(lang, 'recognize.openBuilder')}
				</AppButton>
			</MetalFx>
		{/if}
	{/snippet}
</BottomSheet>

<style>
	.recognize-pick-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.85rem;
	}

	/* Outlined, not filled: one loud CTA per sheet (photo), Excel stays quiet.
	   `ghost` is the only variant without a !important plate from controls.css. */
	.recognize-pick-actions :global(.recognize-pick-outline) {
		padding: var(--control-padding-y) var(--control-padding-x);
		border: 1px solid color-mix(in srgb, var(--color-border) 85%, var(--color-ink));
		border-radius: var(--radius-button);
		background: transparent;
		color: var(--color-ink);
		font-weight: 600;
	}

	.recognize-pick-actions :global(.recognize-pick-outline:hover) {
		border-color: color-mix(in srgb, var(--color-border) 55%, var(--color-ink));
		background: color-mix(in srgb, var(--color-surface-muted) 55%, transparent);
		color: var(--color-ink);
	}

	.recognize-cancel {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-top: 0.9rem;
	}

	.recognize-cancel__rule {
		height: 1px;
		background: var(--color-border);
		opacity: 0.7;
	}

	.recognize-cancel__button {
		min-height: 2.75rem;
		border: none;
		background: none;
		color: var(--color-muted);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.recognize-cancel__button:hover {
		color: var(--color-ink);
	}

	.recognize-working {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.65rem;
		margin-top: 0.85rem;
		padding: 0.75rem 0;
		color: var(--color-muted);
	}
</style>
