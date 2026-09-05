<script lang="ts">
	import { assertCleanClipTitle, assertValidGifBlob, clampClipTitle, CLIP_TITLE_MAX, sanitizeClipTitle, type TechniqueClip } from '$lib/domain/clips';
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
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppPanel from '$lib/components/AppPanel.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import ClipGallery from '$lib/components/clips/ClipGallery.svelte';
	import ClipComposer from '$lib/components/clips/ClipComposer.svelte';
	import ClipLightbox from '$lib/components/clips/ClipLightbox.svelte';
	import { withTimeout } from '$lib/domain/withTimeout';
	import { translate, translateError } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { techniqueClipHints } from '$lib/stores/techniqueClipHints';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { isSupabaseConfigured } from '$lib/supabase/client';
	import { page } from '$app/stores';
	import { replaceState } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import { Plus } from '@lucide/svelte';

	let { exerciseId }: { exerciseId: string } = $props();

	const CLIPS_LOAD_MS = 15000;

	let clips = $state<TechniqueClip[]>([]);
	let loading = $state(false);
	let settled = $state(false);
	/** False until IO/scroll/`?clip=` arms the feed fetch (UI shell still renders). */
	let loadArmed = $state(false);
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
	let sectionEl = $state<HTMLElement | null>(null);
	/** Native `capture` only helps on phones; desktop ignores it → same file picker as gallery. */
	let showNativeCamera = $state(false);
	let renameOpen = $state(false);
	let renameTarget = $state<TechniqueClip | null>(null);
	let renameTitle = $state('');
	let renameBusy = $state(false);

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
	let renameUnchanged = $derived.by(() => {
		if (!renameTarget) return true;
		try {
			return assertCleanClipTitle(renameTitle) === assertCleanClipTitle(renameTarget.title || '');
		} catch {
			return false;
		}
	});
	let renameSaveDisabled = $derived(renameBusy || renameUnchanged || !renameTitle.trim());

	async function refresh(id: string) {
		const gen = ++refreshGen;
		const blocking = !settled;
		if (blocking) loading = true;
		try {
			const list = await withTimeout(listClipsForExercise(id), CLIPS_LOAD_MS);
			if (gen !== refreshGen) return;
			clips = list;
			techniqueClipHints.setExerciseHasClips(id, list.length > 0);
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

	/** Only reset feed state when the exercise id actually changes (not on every effect churn). */
	let lastFeedExerciseId = '';
	let deferGen = 0;

	$effect(() => {
		const id = exerciseId;
		if (id === lastFeedExerciseId) return;
		lastFeedExerciseId = id;
		deferGen += 1;
		refreshGen += 1;
		settled = false;
		loading = false;
		loadArmed = false;
		clips = [];
	});

	/** Sticky CTA covers the bottom ~100px; do not treat that strip as “in view”. */
	const STICKY_CLEARANCE_PX = 100;

	$effect(() => {
		if (typeof window === 'undefined') return;
		const id = exerciseId;
		const el = sectionEl;
		if (!el || loadArmed) return;

		const gen = deferGen;
		const deepLink = Boolean($page.url.searchParams.get('clip'));

		const isAboveSticky = () => {
			const top = el.getBoundingClientRect().top;
			return top < window.innerHeight - STICKY_CLEARANCE_PX;
		};

		const armLoad = () => {
			if (gen !== deferGen || loadArmed) return;
			loadArmed = true;
			loading = true;
			void refresh(id);
		};

		if (deepLink) {
			armLoad();
			return;
		}

		if (isAboveSticky()) {
			armLoad();
			return;
		}

		const onScroll = () => {
			if (!isAboveSticky()) return;
			armLoad();
			window.removeEventListener('scroll', onScroll);
			io.disconnect();
		};

		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				if (!isAboveSticky()) return;
				armLoad();
				io.disconnect();
				window.removeEventListener('scroll', onScroll);
			},
			{
				root: null,
				rootMargin: `0px 0px -${STICKY_CLEARANCE_PX}px 0px`,
				threshold: 0
			}
		);
		io.observe(el);
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			io.disconnect();
			window.removeEventListener('scroll', onScroll);
		};
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
			techniqueClipHints.setExerciseHasClips(exerciseId, true);
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
			techniqueClipHints.setExerciseHasClips(exerciseId, clips.length > 0);
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

	function openRenameSheet(clip: TechniqueClip) {
		renameTarget = clip;
		renameTitle = sanitizeClipTitle(clip.title || '');
		renameOpen = true;
	}

	function dismissRenameSheet() {
		renameOpen = false;
		renameTarget = null;
		renameTitle = '';
	}

	function onRenameTitleInput(event: Event) {
		const el = event.currentTarget as HTMLInputElement;
		const next = clampClipTitle(el.value);
		renameTitle = next;
		if (el.value !== next) el.value = next;
	}

	async function commitRename() {
		if (!renameTarget || renameSaveDisabled) return;
		renameBusy = true;
		try {
			const cleaned = assertCleanClipTitle(renameTitle);
			const clip = renameTarget;
			if (cleaned === assertCleanClipTitle(clip.title || '')) {
				dismissRenameSheet();
				return;
			}
			const renamed = await renameTechniqueClip(clip.id, cleaned);
			clips = clips.map((c) => (c.id === clip.id ? { ...c, title: renamed } : c));
			if (lightbox?.id === clip.id) lightbox = { ...lightbox, title: renamed };
			toasts.show(translate(lang, 'clips.renamed'), 'success');
			dismissRenameSheet();
		} catch (err) {
			toasts.show(translateError(lang, err, 'clips.renameFail'), 'error');
		} finally {
			renameBusy = false;
		}
	}

	function clipTitle(clip: TechniqueClip): string {
		const fallback = translate(lang, 'clips.technique');
		return sanitizeClipTitle(clip.title, fallback) || fallback;
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

<AppPanel bind:ref={sectionEl} aria-labelledby="clips-heading">
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
			<AppButton
				variant="secondary"
				class="clip-section-add shrink-0"
				onclick={openComposer}
				aria-label={translate(lang, 'clips.add')}
				title={translate(lang, 'clips.add')}
			>
				<LucideIcon icon={Plus} size={ICON_BUTTON} />
			</AppButton>
		{/if}
	</div>

	{#if !cloudReady}
		<AppPanel dashed class="mb-3 text-center text-sm text-[var(--color-muted)] md:mb-4">
			{translate(lang, 'clips.needSql')}
		</AppPanel>
	{:else if !$auth.user}
		<AppPanel dashed class="mb-3 text-center text-sm text-[var(--color-muted)] md:mb-4">
			<!-- Card is flex-col: keep link + suffix in one block so they wrap as inline text. -->
			<p class="m-0 text-pretty">
				<a
					class="font-semibold text-[var(--color-accent-text)] underline"
					href={`/auth?next=${encodeURIComponent(`/exercise/${exerciseId}`)}`}
					>{translate(lang, 'clips.signInPublish')}</a
				>{translate(lang, 'clips.signInSuffix')}
			</p>
		</AppPanel>
	{:else if composerOpen}
		<ClipComposer
			open={composerOpen}
			{busy}
			{progress}
			{progressRatio}
			bind:title
			{previewUrl}
			{gifSizeLabel}
			bind:dragOver
			{showNativeCamera}
			onClose={closeComposer}
			onDrop={onDrop}
			onGalleryClick={() => galleryInput?.click()}
			onCameraClick={openCamera}
			onPublish={publish}
			onClearPreview={clearPreview}
		/>
	{/if}

	{#if !loadArmed}
		<!-- Shell only: feed fetch waits for scroll / IO / ?clip= -->
	{:else if loading && !settled}
		<div class="flex justify-center py-3 md:py-8">
			<Spinner label={translate(lang, 'clips.loadingFeed')} size="sm" block={false} />
		</div>
	{:else if clips.length === 0}
		{#if !composerOpen}
			<AppPanel dashed class="mb-3 py-4 text-center md:mb-4 md:py-5">
				<p class="m-0 text-sm font-medium text-[var(--color-ink)]">
					{translate(lang, 'clips.emptyTitle')}
				</p>
				<p class="mt-1 text-xs text-[var(--color-muted)] text-pretty">
					{translate(lang, 'clips.emptyDesc')}
				</p>
				{#if canUpload}
					<AppButton variant="secondary" class="mt-3 text-sm md:mt-4" onclick={openComposer}>
						{translate(lang, 'clips.add')}
					</AppButton>
				{/if}
			</AppPanel>
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
			onRename={openRenameSheet}
			onRemove={removeClip}
			onReport={reportClip}
		/>
	{/if}
</AppPanel>

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
		onRename={() => openRenameSheet(lightbox!)}
		onReport={() => void reportClip(lightbox!)}
	/>
{/if}

<BottomSheet open={renameOpen} titleId="clip-rename-title" dismissible={!renameBusy} onDismiss={dismissRenameSheet}>
	<p id="clip-rename-title" class="bottom-sheet__title">{translate(lang, 'clips.rename')}</p>
	<label class="mt-3 block text-sm font-medium text-[var(--color-ink)]">
		{translate(lang, 'clips.caption')}
		<AppInput
			class="mt-1.5"
			type="text"
			maxlength={CLIP_TITLE_MAX}
			value={renameTitle}
			disabled={renameBusy}
			aria-describedby="clip-rename-count"
			oninput={onRenameTitleInput}
		/>
		<span
			id="clip-rename-count"
			class="clip-composer__caption-count"
			class:clip-composer__caption-count--limit={renameTitle.length >= CLIP_TITLE_MAX}
			aria-live="polite"
		>
			{renameTitle.length}/{CLIP_TITLE_MAX}
		</span>
	</label>
	{#snippet actions()}
		<AppButton variant="secondary" disabled={renameBusy} onclick={dismissRenameSheet}>
			{translate(lang, 'common.cancel')}
		</AppButton>
		<AppButton disabled={renameSaveDisabled} aria-busy={renameBusy} onclick={() => void commitRename()}>
			{#if renameBusy}
				<span class="inline-flex items-center gap-2">
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.wait')}
				</span>
			{:else}
				{translate(lang, 'clips.rename')}
			{/if}
		</AppButton>
	{/snippet}
</BottomSheet>
