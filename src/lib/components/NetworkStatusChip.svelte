<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { outboxCount } from '$lib/storage/syncOutbox';
	import { onMount } from 'svelte';

	let lang = $derived($resolvedLocale);
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

	let visible = $derived(!online || pending > 0);
	let message = $derived(
		!online
			? translate(lang, 'network.offlineChip')
			: translate(lang, 'network.outboxChip', { n: pending })
	);
</script>

{#if visible}
	<div class="network-status-chip" role="status" aria-live="polite">
		<p class="network-status-chip__text">{message}</p>
	</div>
{/if}
