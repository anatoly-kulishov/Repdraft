<script lang="ts">
	import CloseIconButton from '$lib/components/CloseIconButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import Spinner from '$lib/components/Spinner.svelte';
	import { CLIP_TITLE_MAX } from '$lib/domain/clips';
	import { clipEncodeDurationSec } from '$lib/media/videoToGif';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Camera, Image, RefreshCw } from '@lucide/svelte';

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
	<div class="clip-composer">
		<div class="clip-composer__head">
			<p class="clip-composer__title">{translate(lang, 'clips.new')}</p>
			<CloseIconButton disabled={busy} onclick={onClose} />
		</div>

		<div
			class="clip-composer__drop"
			class:is-dragover={dragOver}
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
			<p class="clip-composer__drop-title">{translate(lang, 'clips.drop')}</p>
			<p class="clip-composer__drop-hint">
				{translate(lang, 'clips.limits', { sec: clipEncodeDurationSec() })}
			</p>
			<div class="clip-composer__drop-actions">
				<button
					type="button"
					class="btn-ghost clip-composer__pick"
					disabled={busy}
					onclick={onGalleryClick}
					aria-label={translate(lang, 'clips.gallery')}
					title={translate(lang, 'clips.gallery')}
				>
					<LucideIcon icon={Image} size={ICON_BUTTON} />
				</button>
				{#if showNativeCamera}
					<button
						type="button"
						class="btn-ghost clip-composer__pick"
						disabled={busy}
						onclick={onCameraClick}
						aria-label={translate(lang, 'clips.camera')}
						title={translate(lang, 'clips.camera')}
					>
						<LucideIcon icon={Camera} size={ICON_BUTTON} />
					</button>
				{/if}
			</div>
		</div>

		<label class="clip-composer__caption">
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
					class="mx-auto h-44 w-44 rounded-lg border border-[var(--color-field-border)] bg-black object-contain sm:mx-0"
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
					<button
						type="button"
						class="btn-ghost clip-composer__pick"
						disabled={busy}
						onclick={onClearPreview}
						aria-label={translate(lang, 'clips.otherVideo')}
						title={translate(lang, 'clips.otherVideo')}
					>
						<LucideIcon icon={RefreshCw} size={ICON_BUTTON} />
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}
