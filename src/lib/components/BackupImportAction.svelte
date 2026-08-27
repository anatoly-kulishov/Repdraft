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
	import AppButton from '$lib/components/AppButton.svelte';
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

<AppButton
	variant={variant === 'link' ? 'link' : variant === 'secondary' ? 'secondary' : undefined}
	{block}
	class={className}
	disabled={busy}
	onclick={openImportPicker}
>
	{#if busy}
		<span class="inline-flex items-center justify-center gap-2">
			<Spinner size="sm" block={false} />
			{translate(lang, 'auth.wait')}
		</span>
	{:else}
		{translate(lang, 'settings.importJson')}
	{/if}
</AppButton>
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
			<AppButton variant="secondary" disabled={busy} onclick={dismissImportOffer}>
				{translate(lang, 'common.cancel')}
			</AppButton>
			<AppButton disabled={busy} aria-busy={busy} onclick={() => void commitImport()}>
				{translate(lang, 'settings.importJson')}
			</AppButton>
		{/snippet}
	</BottomSheet>
{/if}
