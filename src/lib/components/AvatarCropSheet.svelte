<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import {
		AVATAR_CROP_EXPORT_PX,
		AVATAR_CROP_MAX_ZOOM,
		avatarCropBaseScale,
		clampAvatarCropOffset
	} from '$lib/domain/avatarImage';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		open = $bindable(false),
		file = null,
		busy = false,
		onConfirm,
		onDismiss
	}: {
		open?: boolean;
		file?: File | null;
		busy?: boolean;
		onConfirm: (file: File) => void;
		onDismiss: () => void;
	} = $props();

	const SIZE = AVATAR_CROP_EXPORT_PX;
	const titleId = 'avatar-crop-title';

	let lang = $derived($resolvedLocale);
	let stageEl = $state<HTMLDivElement | null>(null);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let image = $state<HTMLImageElement | null>(null);
	let stagePx = $state(0);
	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let dragging = $state(false);
	let exportBusy = $state(false);
	let dragStart = $state({ x: 0, y: 0, panX: 0, panY: 0 });

	let locked = $derived(busy || exportBusy);

	$effect(() => {
		const current = file;
		if (!open || !current) {
			image = null;
			return;
		}
		const url = URL.createObjectURL(current);
		const img = new Image();
		let cancelled = false;
		img.decoding = 'async';
		img.onload = () => {
			if (cancelled) return;
			image = img;
			zoom = 1;
			panX = 0;
			panY = 0;
		};
		img.onerror = () => {
			if (cancelled) return;
			image = null;
		};
		img.src = url;
		return () => {
			cancelled = true;
			URL.revokeObjectURL(url);
			image = null;
		};
	});

	$effect(() => {
		const el = stageEl;
		if (!el) return;
		const measure = () => {
			stagePx = el.clientWidth;
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	});

	$effect(() => {
		draw();
	});

	function draw() {
		const canvas = canvasEl;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		canvas.width = SIZE;
		canvas.height = SIZE;
		ctx.clearRect(0, 0, SIZE, SIZE);
		const img = image;
		const stage = stagePx;
		if (!img || stage <= 0) return;
		const factor = SIZE / stage;
		const scale = avatarCropBaseScale(stage, img.naturalWidth, img.naturalHeight) * zoom;
		if (scale <= 0) return;
		const width = img.naturalWidth * scale * factor;
		const height = img.naturalHeight * scale * factor;
		const cx = SIZE / 2 + panX * factor;
		const cy = SIZE / 2 + panY * factor;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(img, cx - width / 2, cy - height / 2, width, height);
	}

	function drawnSize() {
		const img = image;
		const stage = stagePx;
		if (!img || stage <= 0) return { width: 0, height: 0 };
		const scale = avatarCropBaseScale(stage, img.naturalWidth, img.naturalHeight) * zoom;
		return { width: img.naturalWidth * scale, height: img.naturalHeight * scale };
	}

	function reclamp() {
		const stage = stagePx;
		const { width, height } = drawnSize();
		panX = clampAvatarCropOffset(panX, width, stage);
		panY = clampAvatarCropOffset(panY, height, stage);
	}

	function onPointerDown(event: PointerEvent) {
		if (locked || !image) return;
		dragging = true;
		dragStart = { x: event.clientX, y: event.clientY, panX, panY };
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging || locked) return;
		const { width, height } = drawnSize();
		const stage = stagePx;
		panX = clampAvatarCropOffset(dragStart.panX + (event.clientX - dragStart.x), width, stage);
		panY = clampAvatarCropOffset(dragStart.panY + (event.clientY - dragStart.y), height, stage);
	}

	function onPointerUp(event: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		const target = event.currentTarget as HTMLElement;
		if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
	}

	function onZoomInput(event: Event) {
		if (locked) return;
		const next = Number((event.currentTarget as HTMLInputElement).value);
		zoom = Number.isFinite(next)
			? Math.min(AVATAR_CROP_MAX_ZOOM, Math.max(1, next))
			: 1;
		reclamp();
	}

	async function save() {
		const canvas = canvasEl;
		const img = image;
		if (!canvas || !img || locked) return;
		exportBusy = true;
		try {
			const webp = await canvasToBlob(canvas, 'image/webp');
			const blob =
				webp && webp.type === 'image/webp' ? webp : await canvasToBlob(canvas, 'image/jpeg');
			if (!blob || blob.size <= 0) return;
			const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
			const type = blob.type || 'image/jpeg';
			onConfirm(new File([blob], `avatar.${ext}`, { type }));
		} finally {
			exportBusy = false;
		}
	}

	function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
		return new Promise((resolve) => {
			canvas.toBlob((blob) => resolve(blob), type, 0.9);
		});
	}

	function dismiss() {
		if (locked) return;
		onDismiss();
	}
</script>

{#if open}
	<BottomSheet {open} {titleId} dismissible={!locked} onDismiss={dismiss}>
		<div class="bottom-sheet__head">
			<p id={titleId} class="bottom-sheet__title">{translate(lang, 'auth.avatar.cropTitle')}</p>
		</div>
		<div
			bind:this={stageEl}
			class="avatar-crop"
			role="group"
			aria-label={translate(lang, 'auth.avatar.cropHint')}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
		>
			<canvas bind:this={canvasEl} class="avatar-crop__canvas" width={SIZE} height={SIZE}
			></canvas>
			<div class="avatar-crop__mask" aria-hidden="true"></div>
		</div>
		<p class="bottom-sheet__hint">{translate(lang, 'auth.avatar.cropHint')}</p>
		<label class="avatar-crop__zoom">
			<span>{translate(lang, 'auth.avatar.cropZoom')}</span>
			<input
				type="range"
				min="1"
				max={AVATAR_CROP_MAX_ZOOM}
				step="0.01"
				value={zoom}
				disabled={locked}
				oninput={onZoomInput}
			/>
		</label>
		{#snippet actions()}
			<AppButton variant="secondary" disabled={locked} onclick={dismiss}>
				{translate(lang, 'common.cancel')}
			</AppButton>
			<AppButton variant="primary" disabled={locked || !image} onclick={() => void save()}>
				{#if locked}
					<span class="inline-flex items-center gap-2">
						<Spinner size="sm" block={false} />
						{translate(lang, 'auth.wait')}
					</span>
				{:else}
					{translate(lang, 'auth.avatar.cropSave')}
				{/if}
			</AppButton>
		{/snippet}
	</BottomSheet>
{/if}
