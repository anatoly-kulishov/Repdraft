<script lang="ts">
	import Spinner from '$lib/components/Spinner.svelte';
	import { translate } from '$lib/i18n/messages';
	import type { CloudSyncState } from '$lib/domain/cloudSync';

	let {
		state,
		lang,
		onRetry
	}: {
		state: CloudSyncState;
		lang: 'ru' | 'en';
		onRetry: () => void;
	} = $props();

	let visible = $derived(state === 'stale' || state === 'error');
</script>

{#if visible}
	<div
		class="cloud-sync-banner panel"
		role="status"
		class:cloud-sync-banner--error={state === 'error'}
	>
		<div class="cloud-sync-banner__copy">
			{#if state === 'stale'}
				<Spinner size="sm" block={false} />
				<p>{translate(lang, 'sync.cloudLoading')}</p>
			{:else}
				<p>{translate(lang, 'sync.cloudFailed')}</p>
			{/if}
		</div>
		{#if state === 'error'}
			<button type="button" class="btn-secondary cloud-sync-banner__retry" onclick={onRetry}>
				{translate(lang, 'sync.retry')}
			</button>
		{/if}
	</div>
{/if}
