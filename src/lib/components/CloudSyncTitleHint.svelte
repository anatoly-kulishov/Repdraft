<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { translate } from '$lib/i18n/messages';
	import type { CloudSyncState } from '$lib/domain/cloudSync';
	import { RefreshCw } from '@lucide/svelte';

	let {
		sync,
		lang,
		/** Match CloudSyncBanner: avoid flash on a fast local→cloud merge. */
		revealDelayMs = 480
	}: {
		sync: CloudSyncState;
		lang: 'ru' | 'en';
		revealDelayMs?: number;
	} = $props();

	let visible = $state(false);

	$effect(() => {
		if (sync !== 'stale') {
			visible = false;
			return;
		}
		const t = setTimeout(() => {
			visible = true;
		}, revealDelayMs);
		return () => clearTimeout(t);
	});

	let label = $derived(translate(lang, 'sync.cloudLoading'));
</script>

{#if visible}
	<span class="cloud-sync-title-hint" role="status" aria-live="polite" title={label}>
		<LucideIcon icon={RefreshCw} size={14} class="cloud-sync-title-hint__icon" />
		<span class="cloud-sync-title-hint__label">{label}</span>
	</span>
{/if}
