<script lang="ts">
	import {
		assertCleanClipTitle,
		assertValidGifBlob,
		CLIP_TITLE_MAX,
		type TechniqueClip
	} from '$lib/domain/clips';
	import {
		CLIP_LIMITS,
		clipEncodeDurationSec,
		isGifFile,
		isVideoFile,
		readVideoDurationSec,
		videoFileToGif
	} from '$lib/media/videoToGif';
	import {
		deleteTechniqueClip,
		listClipsForExercise,
		publishTechniqueClip,
		renameTechniqueClip,
		reportTechniqueClip
	} from '$lib/storage/techniqueClipsRepository';
	import Spinner from '$lib/components/Spinner.svelte';
	import ClipGallery from '$lib/components/clips/ClipGallery.svelte';
	import ClipLightbox from '$lib/components/clips/ClipLightbox.svelte';
	import { withTimeout } from '$lib/domain/withTimeout';
	import { translate, translateError } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { isSupabaseConfigured } from '$lib/supabase/client';
	import { page } from '$app/stores';
	import { replaceState } from '$app/navigation';
	import { onDestroy, untrack } from 'svelte';

	let { exerciseId }: { exerciseId: string } = $props();

	const CLIPS_LOAD_MS = 15000;

	let clips = $state<TechniqueClip[]>([]);
	let loading = $state(true);
	let settled = $state(false);
	let refreshGen = 0;
	let busy = $state(false);
	let progress = $state('');
	let progressRatio = $state(0);
	let title = $state('');
	let previewUrl = $state<string | null>(null);
	let gifBlob = $state<Blob | null>(null);
	let composerOpen = $state(false);
	let dragOver = $state(false);
	let highlightId = $state<string | null>(null);
	let lightbox = $state<TechniqueClip | null>(null);
	let lightboxReady = $state(false);
	let lightboxFailed = $state(false);
	let thumbReady = $state(new Set<string>());
	let galleryInput: HTMLInputElement | undefined = $state();
	let cameraInput: HTMLInputElement | undefined = $state();
	let sectionEl: HTMLElement | undefined = $state();
	/** Native `capture` only helps on phones; desktop ignores it → same file picker as gallery. */
	let showNativeCamera = $state(false);

	let currentUserId = $derived($auth.user?.id ?? null);
	let cloudReady = $derived(isSupabaseConfigured());
	let lang = $derived($resolvedLocale);
	let canUpload = $derived(cloudReady && Boolean($auth.user));
	let gifSizeLabel = $derived(
		gifBlob ? translate(lang, 'clips.kb', { n: (gifBlob.size / 1024).toFixed(0) }) : null
	);
	let canShareNative = $derived(
		typeof navigator !== 'undefined' && typeof navigator.share === 'function'
	);

	async function refresh(id: string) {
		const gen = ++refreshGen;
		const blocking = !settled;
		if (blocking) loading = true;
		try {
			const list = await withTimeout(listClipsForExercise(id), CLIPS_LOAD_MS);
			if (gen !== refreshGen) return;
			clips = list;
		} catch (err) {
			if (gen !== refreshGen) return;
			console.error(err);
			toasts.show(translateError(lang, err, 'clips.loadFail'), 'error');
			clips = [];
		} finally {
			if (gen !== refreshGen) return;
			loading = false;
			settled = true;
		}
	}

	$effect(() => {
		const id = exerciseId;
		untrack(() => {
			refreshGen += 1;
			settled = false;
			loading = true;
			clips = [];
			void refresh(id);
		});
	});

	$effect(() => {
		const id = $page.url.searchParams.get('clip');
		if (!id || !settled || clips.length === 0) return;
		highlightId = id;
		if (!clips.some((c) => c.id === id)) return;
		queueMicrotask(() => {
			sectionEl
				?.querySelector(`[data-clip-id="${CSS.escape(id)}"]`)
				?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(pointer: coarse), (max-width: 768px)');
		const sync = () => {
			showNativeCamera = mq.matches;
		};
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

	function clearPreview() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = null;
		gifBlob = null;
		progress = '';
		progressRatio = 0;
		if (galleryInput) galleryInput.value = '';
		if (cameraInput) cameraInput.value = '';
	}

	function openComposer() {
		if (!$auth.user) {
			toasts.show(translate(lang, 'clips.signInToast'), 'info');
			return;
		}
		composerOpen = true;
	}

	function closeComposer() {
		composerOpen = false;
		clearPreview();
		title = '';
	}

	/** System rear camera via `<input capture>` — only offered when `showNativeCamera`. */
	function openCamera() {
		if (!$auth.user) {
			toasts.show(translate(lang, 'clips.signInToast'), 'info');
			return;
		}
		composerOpen = true;
		cameraInput?.click();
	}

	onDestroy(() => {
		clearPreview();
	});

	async function processFile(file: File | undefined | null) {
		if (!file) return;
		if (!$auth.user) {
			toasts.show(translate(lang, 'clips.signInToast'), 'info');
			return;
		}

		const gif = isGifFile(file);
		const video = isVideoFile(file);
		if (!gif && !video) {
			toasts.show(translate(lang, 'clips.needVideo'), 'error');
			return;
		}
		if (gif && file.size > CLIP_LIMITS.maxGifBytes) {
			toasts.show(translate(lang, 'clips.tooBigGif'), 'error');
			return;
		}
		if (video && file.size > CLIP_LIMITS.maxVideoBytes) {
			toasts.show(translate(lang, 'clips.tooBig'), 'error');
			return;
		}

		busy = true;
		composerOpen = true;
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = null;
		gifBlob = null;
		progress = '';
		progressRatio = 0;

		try {
			if (gif) {
				await assertValidGifBlob(file, { maxBytes: CLIP_LIMITS.maxGifBytes });
				gifBlob = file;
				previewUrl = URL.createObjectURL(file);
				progress = translate(lang, 'clips.phase.done');
				progressRatio = 1;
				return;
			}

			const maxSec = clipEncodeDurationSec();
			const duration = await readVideoDurationSec(file);
			if (duration > maxSec + 0.15) {
				toasts.show(translate(lang, 'clips.trimmed', { sec: maxSec }), 'info');
			}

			const blob = await videoFileToGif(file, {
				maxDurationSec: maxSec,
				onProgress: (p) => {
					progress = translate(lang, `clips.phase.${p.phase}`);
					progressRatio = p.ratio;
				}
			});
			await assertValidGifBlob(blob, { maxBytes: CLIP_LIMITS.maxGifBytes });
			gifBlob = blob;
			previewUrl = URL.createObjectURL(blob);
		} catch (err) {
			toasts.show(translateError(lang, err, 'clips.gifFail'), 'error');
			clearPreview();
		} finally {
			busy = false;
		}
	}

	function onFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		void processFile(input.files?.[0]);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		if (!canUpload || busy) return;
		void processFile(event.dataTransfer?.files?.[0]);
	}

	async function publish() {
		if (!gifBlob) return;
		busy = true;
		try {
			await assertValidGifBlob(gifBlob, { maxBytes: CLIP_LIMITS.maxGifBytes });
			const cleanTitle = assertCleanClipTitle(title, translate(lang, 'clips.technique'));
			const clip = await publishTechniqueClip({
				exerciseId,
				title: cleanTitle,
				gifBlob
			});
			clips = [clip, ...clips];
			highlightId = clip.id;
			title = '';
			clearPreview();
			composerOpen = false;
			toasts.show(translate(lang, 'clips.published'), 'success');
			queueMicrotask(() => {
				sectionEl
					?.querySelector(`[data-clip-id="${CSS.escape(clip.id)}"]`)
					?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : '';
			if (msg === 'RATE_LIMIT') {
				toasts.show(translate(lang, 'clips.rateLimit'), 'error');
			} else if (msg === 'clips.titleProfane' || msg === 'clips.titleRequired') {
				toasts.show(translate(lang, msg), 'error');
			} else if (
				/relation .*technique_clips/i.test(msg) ||
				/bucket/i.test(msg) ||
				/not find/i.test(msg)
			) {
				toasts.show(translate(lang, 'clips.needSql'), 'error');
			} else {
				toasts.show(translateError(lang, err, 'clips.gifFail'), 'error');
			}
		} finally {
			busy = false;
		}
	}

	function clipPageUrl(clip: TechniqueClip): string {
		return `${$page.url.origin}/exercise/${exerciseId}?clip=${clip.id}`;
	}

	async function shareClip(clip: TechniqueClip) {
		const link = clipPageUrl(clip);
		const text = clip.title || translate(lang, 'clips.shareText');

		if (canShareNative) {
			try {
				const res = await fetch(clip.gifUrl);
				const blob = await res.blob();
				const file = new File([blob], 'technique.gif', { type: 'image/gif' });
				if (navigator.canShare?.({ files: [file] })) {
					await navigator.share({ title: text, text, url: link, files: [file] });
					return;
				}
				await navigator.share({ title: text, text, url: link });
				return;
			} catch (err) {
				if (err instanceof DOMException && err.name === 'AbortError') return;
			}
		}

		try {
			await navigator.clipboard.writeText(link);
			toasts.show(translate(lang, 'clips.linkCopied'), 'success');
		} catch {
			toasts.show(link, 'info');
		}
	}

	async function copyGifUrl(clip: TechniqueClip) {
		try {
			await navigator.clipboard.writeText(clip.gifUrl);
			toasts.show(translate(lang, 'clips.gifCopied'), 'success');
		} catch {
			toasts.show(clip.gifUrl, 'info');
		}
	}

	async function removeClip(clip: TechniqueClip) {
		if (!confirm(translate(lang, 'clips.confirmDelete'))) return;
		try {
			await deleteTechniqueClip(clip);
			clips = clips.filter((c) => c.id !== clip.id);
			if (lightbox?.id === clip.id) lightbox = null;
			if (highlightId === clip.id) {
				highlightId = null;
				const url = new URL($page.url);
				url.searchParams.delete('clip');
				replaceState(url.pathname + url.search, {});
			}
			toasts.show(translate(lang, 'clips.deleted'), 'info');
		} catch (err) {
			toasts.show(translateError(lang, err, 'clips.deleteFail'), 'error');
		}
	}

	async function reportClip(clip: TechniqueClip) {
		if (!$auth.user) {
			toasts.show(translate(lang, 'clips.signInToast'), 'info');
			return;
		}
		if (!confirm(translate(lang, 'clips.confirmReport'))) return;
		try {
			const { hidden } = await reportTechniqueClip(clip.id);
			if (hidden) {
				clips = clips.filter((c) => c.id !== clip.id);
				if (lightbox?.id === clip.id) lightbox = null;
				toasts.show(translate(lang, 'clips.reportedHidden'), 'info');
			} else {
				toasts.show(translate(lang, 'clips.reported'), 'success');
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : '';
			if (msg === 'ALREADY_REPORTED') {
				toasts.show(translate(lang, 'clips.alreadyReported'), 'info');
			} else if (msg === 'NEED_AUTH' || msg === 'errors.needAuth') {
				toasts.show(translate(lang, 'clips.signInToast'), 'info');
			} else if (msg === 'NEED_SQL') {
				toasts.show(translate(lang, 'clips.needModSql'), 'error');
			} else {
				toasts.show(translateError(lang, err, 'clips.reportFail'), 'error');
			}
		}
	}

	async function renameClip(clip: TechniqueClip) {
		const next = prompt(translate(lang, 'clips.renamePrompt'), clip.title || '');
		if (next === null) return;
		try {
			const cleaned = assertCleanClipTitle(next);
			const renamed = await renameTechniqueClip(clip.id, cleaned);
			clips = clips.map((c) => (c.id === clip.id ? { ...c, title: renamed } : c));
			if (lightbox?.id === clip.id) lightbox = { ...lightbox, title: renamed };
			toasts.show(translate(lang, 'clips.renamed'), 'success');
		} catch (err) {
			toasts.show(translateError(lang, err, 'clips.renameFail'), 'error');
		}
	}

	function clipTitle(clip: TechniqueClip): string {
		return clip.title || translate(lang, 'clips.technique');
	}

	function markThumbReady(id: string) {
		if (thumbReady.has(id)) return;
		thumbReady = new Set(thumbReady).add(id);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && lightbox) lightbox = null;
	}

	$effect(() => {
		lightbox;
		lightboxReady = false;
		lightboxFailed = false;
	});

	$effect(() => {
		if (typeof document === 'undefined') return;
		if (!lightbox) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prev;
		};
	});
</script>

<svelte:window onkeydown={onKeydown} />

<input
	bind:this={galleryInput}
	class="sr-only"
	type="file"
	accept={CLIP_LIMITS.accept}
	onchange={onFileChange}
/>
{#if showNativeCamera}
	<input
		bind:this={cameraInput}
		class="sr-only"
		type="file"
		accept="video/*"
		capture="environment"
		onchange={onFileChange}
	/>
{/if}

<section bind:this={sectionEl} class="panel" aria-labelledby="clips-heading">
	<div class="mb-3 flex flex-wrap items-start justify-between gap-3 md:mb-4">
		<div>
			<h2 id="clips-heading" class="section-title">
				{translate(lang, 'clips.title')}
			</h2>
			<p class="mt-1 text-xs text-[var(--color-muted)]">
				{translate(lang, 'clips.lead')}
			</p>
		</div>
		{#if canUpload && !composerOpen && clips.length > 0}
			<button type="button" class="btn-primary shrink-0 text-sm" onclick={openComposer}>
				{translate(lang, 'clips.add')}
			</button>
		{/if}
	</div>

	{#if !cloudReady}
		<p class="panel-dashed mb-3 text-sm text-[var(--color-muted)] md:mb-4">
			{translate(lang, 'clips.needSql')}
		</p>
	{:else if !$auth.user}
		<p class="panel-dashed mb-3 text-sm text-[var(--color-muted)] md:mb-4">
			<a
				class="font-semibold text-[var(--color-accent)] underline"
				href={`/auth?next=${encodeURIComponent(`/exercise/${exerciseId}`)}`}
				>{translate(lang, 'clips.signInPublish')}</a
			>{translate(lang, 'clips.signInSuffix')}
		</p>
	{:else if composerOpen}
		<div class="panel-inset mb-3 space-y-3 md:mb-4">
			<div class="flex items-center justify-between gap-2">
				<p class="text-sm font-semibold">{translate(lang, 'clips.new')}</p>
				<button type="button" class="btn-secondary" disabled={busy} onclick={closeComposer}>
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
					<button
						type="button"
						class="btn-secondary text-sm"
						disabled={busy}
						onclick={() => galleryInput?.click()}
					>
						{translate(lang, 'clips.gallery')}
					</button>
					{#if showNativeCamera}
						<button type="button" class="btn-secondary text-sm" disabled={busy} onclick={openCamera}>
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
						<button type="button" class="btn-primary" disabled={busy} onclick={publish}>
							{translate(lang, 'clips.publish')}
						</button>
						<button type="button" class="btn-secondary" disabled={busy} onclick={clearPreview}>
							{translate(lang, 'clips.otherVideo')}
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if loading && !settled}
		<div class="flex justify-center py-3 md:py-8">
			<Spinner label={translate(lang, 'clips.loadingFeed')} size="sm" block={false} />
		</div>
	{:else if clips.length === 0}
		{#if !composerOpen}
			<div class="panel-dashed py-4 text-center md:py-8">
				<p class="text-sm font-medium">{translate(lang, 'clips.emptyTitle')}</p>
				<p class="mt-1 text-xs text-[var(--color-muted)]">
					{translate(lang, 'clips.emptyDesc')}
				</p>
				{#if canUpload}
					<button type="button" class="btn-primary mt-3 text-sm md:mt-4" onclick={openComposer}>
						{translate(lang, 'clips.add')}
					</button>
				{/if}
			</div>
		{/if}
	{:else}
		<ClipGallery
			{clips}
			{lang}
			{highlightId}
			{currentUserId}
			{canShareNative}
			{thumbReady}
			titleFor={clipTitle}
			onOpen={(clip) => (lightbox = clip)}
			onThumbReady={markThumbReady}
			onShare={shareClip}
			onCopyGif={copyGifUrl}
			onRename={renameClip}
			onRemove={removeClip}
			onReport={reportClip}
		/>
	{/if}
</section>

{#if lightbox}
	<ClipLightbox
		clip={lightbox}
		{lang}
		{currentUserId}
		{canShareNative}
		title={clipTitle(lightbox)}
		bind:ready={lightboxReady}
		bind:failed={lightboxFailed}
		onClose={() => (lightbox = null)}
		onShare={() => void shareClip(lightbox!)}
		onRename={() => void renameClip(lightbox!)}
		onReport={() => void reportClip(lightbox!)}
	/>
{/if}
