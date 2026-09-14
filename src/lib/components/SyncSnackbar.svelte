<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import Spinner from '$lib/components/Spinner.svelte';
	import { translate } from '$lib/i18n/messages';
	import { flushSyncOutbox } from '$lib/storage/flushSyncOutbox';
	import { outboxCount } from '$lib/storage/syncOutbox';
	import { resolvedLocale } from '$lib/stores/locale';
	import { outboxSyncUi, type OutboxSyncPhase } from '$lib/stores/outboxSyncUi';
	import { AlertCircle, Check } from '@lucide/svelte';
	import { onMount } from 'svelte';

	let lang = $derived($resolvedLocale);
	let phase = $derived($outboxSyncUi);
	let online = $state(true);
	let pending = $state(0);

	function refresh() {
		if (typeof navigator === 'undefined') return;
		online = navigator.onLine;
		pending = outboxCount();
	}

	onMount(() => {
		refresh();
		const onChange = () => refresh();
		window.addEventListener('online', onChange);
		window.addEventListener('offline', onChange);
		document.addEventListener('visibilitychange', onChange);
		window.addEventListener('repdraft:outbox', onChange);
		return () => {
			window.removeEventListener('online', onChange);
			window.removeEventListener('offline', onChange);
			document.removeEventListener('visibilitychange', onChange);
			window.removeEventListener('repdraft:outbox', onChange);
		};
	});

	type SnackbarMode = OutboxSyncPhase | 'pending' | 'offline' | 'hidden';

	let mode = $derived.by((): SnackbarMode => {
		switch (phase) {
			case 'syncing':
				return 'syncing';
			case 'success':
				return 'success';
			case 'error':
				return 'error';
			case 'idle':
				if (pending > 0) return 'pending';
				if (!online) return 'offline';
				return 'hidden';
			default: {
				const _exhaustive: never = phase;
				return _exhaustive;
			}
		}
	});

	let visible = $derived(mode !== 'hidden');

	function retry() {
		void flushSyncOutbox();
	}
</script>

{#if visible}
	<div class="sync-snackbar" class:sync-snackbar--interactive={mode === 'error'}>
		{#if mode === 'syncing'}
			<div
				class="sync-snackbar__pill sync-snackbar__pill--syncing"
				role="status"
				aria-live="polite"
			>
				<Spinner size="sm" block={false} label={translate(lang, 'network.syncing')} />
			</div>
		{:else if mode === 'success'}
			<div
				class="sync-snackbar__pill sync-snackbar__pill--success"
				role="status"
				aria-live="polite"
			>
				<span class="sync-snackbar__icon" aria-hidden="true">
					<LucideIcon icon={Check} size={ICON_SMALL} />
				</span>
				<span class="sync-snackbar__label">{translate(lang, 'network.syncSuccess')}</span>
			</div>
		{:else if mode === 'error'}
			<button
				type="button"
				class="sync-snackbar__pill sync-snackbar__pill--error"
				aria-label={translate(lang, 'network.syncFailed')}
				title={translate(lang, 'sync.retry')}
				onclick={retry}
			>
				<span class="sync-snackbar__icon" aria-hidden="true">
					<LucideIcon icon={AlertCircle} size={ICON_SMALL} />
				</span>
				<span class="sync-snackbar__label">{translate(lang, 'network.syncFailed')}</span>
			</button>
		{:else if mode === 'pending'}
			<div
				class="sync-snackbar__pill sync-snackbar__pill--pending"
				role="status"
				aria-live="polite"
			>
				<span class="sync-snackbar__label"
					>{translate(lang, 'network.waitingToSave', { n: pending })}</span
				>
			</div>
		{:else if mode === 'offline'}
			<div
				class="sync-snackbar__pill sync-snackbar__pill--pending"
				role="status"
				aria-live="polite"
			>
				<span class="sync-snackbar__label">{translate(lang, 'network.offlineChip')}</span>
			</div>
		{/if}
	</div>
{/if}
