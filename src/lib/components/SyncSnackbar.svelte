<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import Spinner from '$lib/components/Spinner.svelte';
	import { shouldRetryOutboxFlush } from '$lib/domain/outboxFlushGate';
	import { translate } from '$lib/i18n/messages';
	import { isCloudMode } from '$lib/storage/dataAccess';
	import { flushSyncOutbox } from '$lib/storage/flushSyncOutbox';
	import { outboxCount } from '$lib/storage/syncOutbox';
	import { resolvedLocale } from '$lib/stores/locale';
	import { outboxSyncUi, type OutboxSyncPhase } from '$lib/stores/outboxSyncUi';
	import { toasts } from '$lib/stores/toasts';
	import { WarningCircle as AlertCircle, Check } from 'phosphor-svelte';
	import { onMount } from 'svelte';

	/** Online: keep probing (iOS often skips `online`). Offline: rare silent probe. */
	const ONLINE_RETRY_MS = 12_000;
	const OFFLINE_PROBE_MS = 60_000;

	let lang = $derived($resolvedLocale);
	let phase = $derived($outboxSyncUi);
	let online = $state(true);
	let pending = $state(0);
	let cloudMode = $state(false);
	/** Undo / status toasts sit in the same band; do not stack success under them. */
	let toastCueActive = $derived($toasts.length > 0);

	function refresh() {
		if (typeof navigator === 'undefined') return;
		online = navigator.onLine;
		pending = outboxCount();
		cloudMode = isCloudMode();
	}

	function tryFlush(opts: { silent?: boolean; forceVisible?: boolean } = {}) {
		refresh();
		if (!cloudMode || pending === 0) return;
		/* Offline: only silent probes so we do not flash Syncing / Sync failed. */
		if (!online && !opts.forceVisible) {
			void flushSyncOutbox({ silent: true });
			return;
		}
		void flushSyncOutbox({ silent: opts.silent === true && !opts.forceVisible });
	}

	onMount(() => {
		refresh();
		let onlineTimer: number | undefined;
		let offlineTimer: number | undefined;

		const clearTimers = () => {
			if (onlineTimer !== undefined) window.clearInterval(onlineTimer);
			if (offlineTimer !== undefined) window.clearInterval(offlineTimer);
			onlineTimer = undefined;
			offlineTimer = undefined;
		};

		const armTimers = () => {
			clearTimers();
			refresh();
			if (online) {
				onlineTimer = window.setInterval(() => tryFlush(), ONLINE_RETRY_MS);
			} else {
				offlineTimer = window.setInterval(
					() => tryFlush({ silent: true }),
					OFFLINE_PROBE_MS
				);
			}
		};

		const onChange = () => {
			refresh();
			armTimers();
		};
		const onOnlineOrCloud = () => {
			refresh();
			armTimers();
			/* Visible flush after reconnect / cloud unlock. */
			tryFlush({ forceVisible: true });
		};
		const onVisible = () => {
			onChange();
			if (document.visibilityState === 'visible') {
				tryFlush({ silent: !online, forceVisible: online });
			}
		};

		window.addEventListener('online', onOnlineOrCloud);
		window.addEventListener('offline', onChange);
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('repdraft:outbox', onChange);
		window.addEventListener('repdraft:cloud-mode', onOnlineOrCloud);
		armTimers();
		tryFlush({ silent: !online, forceVisible: online });

		return () => {
			window.removeEventListener('online', onOnlineOrCloud);
			window.removeEventListener('offline', onChange);
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('repdraft:outbox', onChange);
			window.removeEventListener('repdraft:cloud-mode', onOnlineOrCloud);
			clearTimers();
		};
	});

	type SnackbarMode = OutboxSyncPhase | 'pending' | 'offline' | 'hidden';

	let mode = $derived.by((): SnackbarMode => {
		switch (phase) {
			case 'syncing':
				/* Offline probe must not keep the Syncing spinner visible. */
				return online ? 'syncing' : 'offline';
			case 'success':
				return 'success';
			case 'error':
				return online ? 'error' : 'offline';
			case 'idle':
				if (!online) return 'offline';
				if (pending > 0) return 'pending';
				return 'hidden';
			default: {
				const _exhaustive: never = phase;
				return _exhaustive;
			}
		}
	});

	let visible = $derived(mode !== 'hidden' && !toastCueActive);
	let pendingCanRetry = $derived(
		mode === 'pending' && shouldRetryOutboxFlush({ online, cloudMode, pendingCount: pending })
	);

	function retry() {
		void flushSyncOutbox();
	}

	let offlineLabel = $derived(
		pending > 0
			? translate(lang, 'network.offlineWaiting', { n: pending })
			: translate(lang, 'network.offlineChip')
	);
</script>

{#if visible}
	<div
		class="sync-snackbar"
		class:sync-snackbar--interactive={mode === 'error' || pendingCanRetry}
	>
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
		{:else if mode === 'pending' && pendingCanRetry}
			<button
				type="button"
				class="sync-snackbar__pill sync-snackbar__pill--pending"
				aria-label={translate(lang, 'network.waitingToSave', { n: pending })}
				title={translate(lang, 'sync.retry')}
				onclick={retry}
			>
				<span class="sync-snackbar__label"
					>{translate(lang, 'network.waitingToSave', { n: pending })}</span
				>
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
				<span class="sync-snackbar__label">{offlineLabel}</span>
			</div>
		{/if}
	</div>
{/if}
