<script lang="ts">
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import ExerciseSessionHistory from '$lib/components/ExerciseSessionHistory.svelte';
	import { translate } from '$lib/i18n/messages';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';
	import { onMount } from 'svelte';

	let {
		open = false,
		exerciseId,
		onDismiss
	}: {
		open?: boolean;
		exerciseId: string;
		onDismiss: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let historyReady = $state(false);
	let titleId = $derived(`live-history-${exerciseId}`);

	onMount(() => {
		void live.refreshHistory().finally(() => {
			historyReady = true;
		});
	});
</script>

{#if open}
	<BottomSheet {open} raised {titleId} {onDismiss}>
		<div class="bottom-sheet__head">
			<p id={titleId} class="bottom-sheet__title">{translate(lang, 'live.historyTitle')}</p>
		</div>
		<div class="live-history-sheet__body">
			<ExerciseSessionHistory
				{exerciseId}
				linkRows={false}
				showEmptyCoachmark={false}
				panel={false}
				emptyMessageKey="live.historyEmpty"
				ready={historyReady}
			/>
		</div>
	</BottomSheet>
{/if}
