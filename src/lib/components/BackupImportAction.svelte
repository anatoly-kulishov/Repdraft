<script lang="ts">
	import {
		mergeLocalWithImport,
		parseExportJson,
		type RepdraftExportPayload
	} from '$lib/domain/exportData';
	import { translate, translateError } from '$lib/i18n/messages';
	import { localRecordRepository } from '$lib/storage/localRecordRepository';
	import { localSessionRepository } from '$lib/storage/localSessionRepository';
	import { localWorkoutRepository } from '$lib/storage/localWorkoutRepository';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';
	import { plans } from '$lib/stores/plans';
	import { records } from '$lib/stores/records';
	import { toasts } from '$lib/stores/toasts';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let {
		variant = 'secondary',
		block = false,
		class: className = ''
	}: {
		variant?: 'primary' | 'secondary' | 'link';
		block?: boolean;
		class?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
	let busy = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();
	let pendingPayload = $state<RepdraftExportPayload | null>(null);
	let importOfferOpen = $state(false);

	let buttonClass = $derived.by(() => {
		const base =
			variant === 'link'
				? 'btn-link'
				: variant === 'primary'
					? 'btn-primary'
					: 'btn-secondary';
		const layout = block ? 'btn-block w-full' : '';
		return `${base} ${layout} ${className}`.trim();
	});

	async function loadLocalBundle() {
		const [plansList, sessions, recordsList] = await Promise.all([
			localWorkoutRepository.list(),
			localSessionRepository.list(),
			localRecordRepository.list()
		]);
		return { plans: plansList, sessions, records: recordsList };
	}

	function openImportPicker() {
		if (busy) return;
		fileInput?.click();
	}

	async function onImportFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || busy) return;

		try {
			const text = await file.text();
			const parsed = parseExportJson(text);
			if (!parsed.ok) {
				const key =
					parsed.reason === 'invalidJson'
						? 'settings.importInvalidJson'
						: parsed.reason === 'unsupportedVersion'
							? 'settings.importUnsupported'
							: 'settings.importInvalidShape';
				toasts.show(translate(lang, key), 'error');
				return;
			}
			pendingPayload = parsed.payload;
			importOfferOpen = true;
		} catch (err) {
			toasts.show(translateError(lang, err, 'settings.importFail'), 'error');
		}
	}

	function dismissImportOffer() {
		if (busy) return;
		importOfferOpen = false;
		pendingPayload = null;
	}

	async function commitImport() {
		if (!pendingPayload || busy) return;
		busy = true;
		try {
			const current = await loadLocalBundle();
			const merged = mergeLocalWithImport(current, pendingPayload);

			await Promise.all([
				...merged.plans.map((plan) => localWorkoutRepository.save(plan)),
				...merged.sessions.map((session) => localSessionRepository.save(session)),
				...merged.records.map((record) => localRecordRepository.save(record))
			]);

			await Promise.all([
				plans.refresh({ cloud: false, force: true }),
				records.refresh({ cloud: false, force: true }),
				live.refreshHistory()
			]);

			toasts.show(translate(lang, 'settings.importDone'), 'success');
			importOfferOpen = false;
			pendingPayload = null;
		} catch (err) {
			toasts.show(translateError(lang, err, 'settings.importFail'), 'error');
		} finally {
			busy = false;
		}
	}
</script>

<button type="button" class={buttonClass} disabled={busy} onclick={openImportPicker}>
	{#if busy}
		<span class="inline-flex items-center justify-center gap-2">
			<Spinner size="sm" block={false} />
			{translate(lang, 'auth.wait')}
		</span>
	{:else}
		{translate(lang, 'settings.importJson')}
	{/if}
</button>
<input
	bind:this={fileInput}
	type="file"
	accept="application/json,.json"
	class="sr-only"
	tabindex="-1"
	onchange={(e) => void onImportFile(e)}
/>

{#if importOfferOpen}
	<BottomSheet
		open={importOfferOpen}
		titleId="backup-import-offer-title"
		dismissible={!busy}
		onDismiss={dismissImportOffer}
	>
		<p id="backup-import-offer-title" class="bottom-sheet__title">
			{translate(lang, 'settings.importConfirmTitle')}
		</p>
		<p class="bottom-sheet__hint">{translate(lang, 'settings.importConfirm')}</p>
		{#snippet actions()}
			<button type="button" class="btn-secondary" disabled={busy} onclick={dismissImportOffer}>
				{translate(lang, 'common.cancel')}
			</button>
			<button
				type="button"
				class="btn-primary"
				disabled={busy}
				aria-busy={busy}
				onclick={() => void commitImport()}
			>
				{translate(lang, 'settings.importJson')}
			</button>
		{/snippet}
	</BottomSheet>
{/if}
