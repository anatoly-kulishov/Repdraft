<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		open = false,
		titleId,
		title,
		hint = '',
		imagePath,
		detailHref = null as string | null,
		onDismiss
	}: {
		open?: boolean;
		titleId: string;
		title: string;
		hint?: string;
		/** Catalog JPG path, e.g. `images/foo.jpg` - GIF resolved under /videos. */
		imagePath: string;
		detailHref?: string | null;
		onDismiss: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let techniqueSrc = $derived(
		`/${imagePath.replace(/^images\//, 'videos/').replace(/\.jpe?g$/i, '.gif')}`
	);

	function onImgError(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		const fallback = `/${imagePath}`;
		if (img.src.endsWith(fallback) || img.getAttribute('src') === fallback) return;
		img.src = fallback;
	}
</script>

{#snippet sheetBody()}
	<div class="bottom-sheet__head">
		<p id={titleId} class="bottom-sheet__title">{title}</p>
	</div>
	{#if hint}
		<p class="bottom-sheet__hint">{hint}</p>
	{/if}
	<div class="exercise-technique-sheet__media media-well">
		<img
			src={techniqueSrc}
			alt=""
			width="180"
			height="180"
			decoding="async"
			class="exercise-technique-sheet__img"
			onerror={onImgError}
		/>
	</div>
{/snippet}

{#snippet actions()}
	{#if detailHref}
		<AppButton block href={detailHref} onclick={onDismiss}>
			{translate(lang, 'exercise.openCard')}
		</AppButton>
	{/if}
{/snippet}

{#if open}
	<BottomSheet {open} raised {titleId} {onDismiss} actions={detailHref ? actions : null}>
		{@render sheetBody()}
	</BottomSheet>
{/if}
