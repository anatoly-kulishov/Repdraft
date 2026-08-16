<script lang="ts">
	import Spinner from '$lib/components/Spinner.svelte';
	import { translate } from '$lib/i18n/messages';
	import type { CloudSyncState } from '$lib/domain/cloudSync';

	let {
		sync,
		lang,
		onRetry,
		/** Hide while a page-level skeleton already covers loading (avoids layout jump). */
		suppressed = false
	}: {
		sync: CloudSyncState;
		lang: 'ru' | 'en';
		onRetry: () => void;
		suppressed?: boolean;
	} = $props();

	/** Debounce stale so a fast local→cloud merge does not flash the banner. */
	const STALE_REVEAL_MS = 480;
	let showStale = $state(false);

	$effect(() => {
		if (suppressed || sync !== 'stale') {
			showStale = false;
			return;
		}
		const t = setTimeout(() => {
			showStale = true;
		}, STALE_REVEAL_MS);
		return () => clearTimeout(t);
	});

	let visible = $derived(!suppressed && (sync === 'error' || showStale));
</script>

{#if visible}
	<div
		class="cloud-sync-banner panel"
		role="status"
		class:cloud-sync-banner--error={sync === 'error'}
	>
		<div class="cloud-sync-banner__copy">
			{#if sync === 'stale'}
				<Spinner size="sm" block={false} />
				<p>{translate(lang, 'sync.cloudLoading')}</p>
			{:else}
				<p>{translate(lang, 'sync.cloudFailed')}</p>
			{/if}
		</div>
		{#if sync === 'error'}
			<button type="button" class="btn-secondary cloud-sync-banner__retry" onclick={onRetry}>
				{translate(lang, 'sync.retry')}
			</button>
		{/if}
	</div>
{/if}
