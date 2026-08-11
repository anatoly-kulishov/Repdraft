<script lang="ts">
	import Spinner from '$lib/components/Spinner.svelte';
	import { CLIP_TITLE_MAX } from '$lib/domain/clips';
	import { clipEncodeDurationSec } from '$lib/media/videoToGif';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		open = false,
		busy = false,
		progress = '',
		progressRatio = 0,
		title = $bindable(''),
		previewUrl = null as string | null,
		gifSizeLabel = null as string | null,
		dragOver = $bindable(false),
		showNativeCamera = false,
		onClose,
		onDrop,
		onGalleryClick,
		onCameraClick,
		onPublish,
		onClearPreview
	}: {
		open?: boolean;
		busy?: boolean;
		progress?: string;
		progressRatio?: number;
		title?: string;
		previewUrl?: string | null;
		gifSizeLabel?: string | null;
		dragOver?: boolean;
		showNativeCamera?: boolean;
		onClose: () => void;
		onDrop: (event: DragEvent) => void;
		onGalleryClick: () => void;
		onCameraClick: () => void;
		onPublish: () => void;
		onClearPreview: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
</script>

{#if open}
	<div class="panel-inset mb-3 space-y-3 md:mb-4">
		<div class="flex items-center justify-between gap-2">
			<p class="text-sm font-semibold">{translate(lang, 'clips.new')}</p>
			<button type="button" class="btn-secondary" disabled={busy} onclick={onClose}>
				{translate(lang, 'clips.close')}
			</button>
		</div>

		<div
			class="relative rounded-xl border-2 border-dashed px-3 py-4 text-center transition-colors md:py-6"
			class:border-[var(--color-accent)]={dragOver}
			class:bg-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-surface))]={dragOver}
			class:border-[var(--color-border)]={!dragOver}
			role="region"
			aria-label={translate(lang, 'clips.dropZone')}
			ondragover={(e) => {
				if (!busy) {
					e.preventDefault();
					dragOver = true;
				}
			}}
			ondragleave={() => {
				dragOver = false;
			}}
			ondrop={onDrop}
		>
			<p class="text-sm font-medium">{translate(lang, 'clips.drop')}</p>
			<p class="mt-1 text-xs text-[var(--color-muted)]">
				{translate(lang, 'clips.limits', { sec: clipEncodeDurationSec() })}
			</p>
			<div class="mt-3 flex flex-wrap justify-center gap-2">
				<button type="button" class="btn-secondary text-sm" disabled={busy} onclick={onGalleryClick}>
					{translate(lang, 'clips.gallery')}
				</button>
				{#if showNativeCamera}
					<button type="button" class="btn-secondary text-sm" disabled={busy} onclick={onCameraClick}>
						{translate(lang, 'clips.camera')}
					</button>
				{/if}
			</div>
		</div>

		<label class="field-label">
			{translate(lang, 'clips.caption')}
			<input
				class="field mt-1"
				type="text"
				maxlength={CLIP_TITLE_MAX}
				placeholder={translate(lang, 'clips.captionPh')}
				bind:value={title}
				disabled={busy}
			/>
		</label>

		{#if busy || progress}
			<div class="space-y-1" aria-live="polite">
				<div class="h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
					<div
						class="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-200"
						style={`width: ${Math.round(progressRatio * 100)}%`}
					></div>
				</div>
				<p class="text-xs text-[var(--color-muted)]">
					{progress || translate(lang, 'clips.processing')}
				</p>
			</div>
		{/if}

		{#if previewUrl}
			<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
				<img
					src={previewUrl}
					alt={translate(lang, 'clips.preview')}
					class="mx-auto h-44 w-44 rounded-lg border border-[var(--color-border)] bg-black object-contain sm:mx-0"
				/>
				<div class="flex flex-1 flex-col gap-2">
					{#if gifSizeLabel}
						<p class="text-xs text-[var(--color-muted)]">
							{translate(lang, 'clips.size', { size: gifSizeLabel })}
						</p>
					{/if}
					<button type="button" class="btn-primary" disabled={busy} onclick={onPublish}>
						{translate(lang, 'clips.publish')}
					</button>
					<button type="button" class="btn-secondary" disabled={busy} onclick={onClearPreview}>
						{translate(lang, 'clips.otherVideo')}
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}
