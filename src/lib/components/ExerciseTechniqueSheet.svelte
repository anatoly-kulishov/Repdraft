<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ImageOff } from '@lucide/svelte';

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
	let stillSrc = $derived(`/${imagePath}`);
	let gifSrc = $derived(
		`/${imagePath.replace(/^images\//, 'videos/').replace(/\.jpe?g$/i, '.gif')}`
	);

	let stillFailed = $state(false);
	let gifReady = $state(false);
	let gifFailed = $state(false);

	/* Reset layers when the sheet opens on another exercise (or reopens). */
	$effect(() => {
		if (!open) return;
		void imagePath;
		stillFailed = false;
		gifReady = false;
		gifFailed = false;
	});
</script>

{#snippet sheetBody()}
	<div class="bottom-sheet__head">
		<p id={titleId} class="bottom-sheet__title">{title}</p>
	</div>
	{#if hint}
		<p class="bottom-sheet__hint">{hint}</p>
	{/if}
	<div
		class="exercise-technique-sheet__media media-well"
		class:is-placeholder={stillFailed}
		class:is-empty={stillFailed}
	>
		{#if stillFailed}
			<div class="exercise-technique-sheet__fail" role="status">
				<LucideIcon icon={ImageOff} size={28} class="exercise-technique-sheet__fail-icon" />
				<p class="exercise-technique-sheet__fail-text">
					{translate(lang, 'exercise.mediaUnavailable')}
				</p>
			</div>
		{:else}
			<img
				src={stillSrc}
				alt=""
				width="180"
				height="180"
				decoding="async"
				class="exercise-technique-sheet__img exercise-technique-sheet__img--still"
				onerror={() => {
					stillFailed = true;
					gifFailed = true;
				}}
			/>
			{#if !gifFailed}
				<img
					src={gifSrc}
					alt=""
					width="180"
					height="180"
					decoding="async"
					class="exercise-technique-sheet__img exercise-technique-sheet__img--gif"
					class:is-ready={gifReady}
					onload={() => {
						gifReady = true;
					}}
					onerror={() => {
						gifFailed = true;
						gifReady = false;
					}}
				/>
			{/if}
		{/if}
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
