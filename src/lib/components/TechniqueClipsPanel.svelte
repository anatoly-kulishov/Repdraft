<script lang="ts">
	import type { TechniqueClip } from '$lib/domain/clips';
	import { CLIP_LIMITS, videoFileToGif } from '$lib/media/videoToGif';
	import {
		deleteTechniqueClip,
		listClipsForExercise,
		publishTechniqueClip
	} from '$lib/storage/techniqueClipsRepository';
	import { auth } from '$lib/stores/auth';
	import { toasts } from '$lib/stores/toasts';
	import { isSupabaseConfigured } from '$lib/supabase/client';
	import { page } from '$app/stores';

	let { exerciseId }: { exerciseId: string } = $props();

	let clips = $state<TechniqueClip[]>([]);
	let loading = $state(true);
	let busy = $state(false);
	let progress = $state('');
	let progressRatio = $state(0);
	let title = $state('');
	let previewUrl = $state<string | null>(null);
	let gifBlob = $state<Blob | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();

	let currentUserId = $derived($auth.user?.id ?? null);
	let cloudReady = $derived(isSupabaseConfigured());

	async function refresh() {
		loading = true;
		try {
			clips = await listClipsForExercise(exerciseId);
		} catch (err) {
			console.error(err);
			toasts.show(err instanceof Error ? err.message : 'Не удалось загрузить клипы', 'error');
			clips = [];
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		exerciseId;
		void refresh();
	});

	function clearPreview() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = null;
		gifBlob = null;
		progress = '';
		progressRatio = 0;
		if (fileInput) fileInput.value = '';
	}

	async function onFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!$auth.user) {
			toasts.show('Войдите, чтобы публиковать технику', 'info');
			input.value = '';
			return;
		}
		if (file.size > CLIP_LIMITS.maxVideoBytes) {
			toasts.show('Видео больше 15 МБ — возьмите короткий ролик', 'error');
			input.value = '';
			return;
		}

		busy = true;
		clearPreview();
		try {
			const blob = await videoFileToGif(file, {
				onProgress: (p) => {
					progress = p.message;
					progressRatio = p.ratio;
				}
			});
			gifBlob = blob;
			previewUrl = URL.createObjectURL(blob);
			toasts.show('GIF готов — можно публиковать', 'success');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : 'Не удалось сделать GIF', 'error');
		} finally {
			busy = false;
		}
	}

	async function publish() {
		if (!gifBlob) return;
		busy = true;
		try {
			const clip = await publishTechniqueClip({
				exerciseId,
				title,
				gifBlob
			});
			clips = [clip, ...clips];
			title = '';
			clearPreview();
			toasts.show('Опубликовано в сообществе', 'success');
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Ошибка публикации';
			if (/relation .*technique_clips/i.test(msg) || /bucket/i.test(msg) || /not find/i.test(msg)) {
				toasts.show('Сначала выполните supabase/technique_clips.sql в Supabase', 'error');
			} else {
				toasts.show(msg, 'error');
			}
		} finally {
			busy = false;
		}
	}

	async function shareClip(clip: TechniqueClip) {
		const link = `${$page.url.origin}/exercise/${exerciseId}?clip=${clip.id}`;
		try {
			await navigator.clipboard.writeText(link);
			toasts.show('Ссылка скопирована', 'success');
		} catch {
			toasts.show(link, 'info');
		}
	}

	async function shareGif(clip: TechniqueClip) {
		try {
			await navigator.clipboard.writeText(clip.gifUrl);
			toasts.show('Ссылка на GIF скопирована', 'success');
		} catch {
			toasts.show(clip.gifUrl, 'info');
		}
	}

	async function removeClip(clip: TechniqueClip) {
		if (!confirm('Удалить этот GIF?')) return;
		try {
			await deleteTechniqueClip(clip);
			clips = clips.filter((c) => c.id !== clip.id);
			toasts.show('Удалено', 'info');
		} catch (err) {
			toasts.show(err instanceof Error ? err.message : 'Не удалось удалить', 'error');
		}
	}

	function formatDate(iso: string): string {
		try {
			return new Intl.DateTimeFormat('ru-RU', {
				day: 'numeric',
				month: 'short'
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	}
</script>

<section class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="mb-3">
		<h2 class="font-[family-name:var(--font-display)] text-xl">Техника сообщества</h2>
		<p class="mt-1 text-xs text-[var(--color-muted)]">
			Загрузите короткое видео (до ~{CLIP_LIMITS.maxDurationSec} сек) — мы сделаем GIF для обмена.
		</p>
	</div>

	{#if !cloudReady}
		<p class="mb-4 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-3 text-sm text-[var(--color-muted)]">
			Нужен Supabase и скрипт <code class="text-[var(--color-ink)]">technique_clips.sql</code>, чтобы публиковать GIF.
		</p>
	{:else if !$auth.user}
		<p class="mb-4 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-3 text-sm text-[var(--color-muted)]">
			<a class="font-semibold text-[var(--color-accent)] underline" href="/auth">Войдите</a>, чтобы публиковать свою технику.
		</p>
	{:else}
		<div class="mb-4 space-y-3 rounded-xl border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_55%,white)] p-3">
			<label class="block text-xs font-medium text-[var(--color-muted)]">
				Видео с техникой
				<input
					bind:this={fileInput}
					class="mt-1 block w-full text-sm"
					type="file"
					accept={CLIP_LIMITS.accept}
					disabled={busy}
					onchange={onFileChange}
				/>
			</label>

			<label class="block text-xs font-medium text-[var(--color-muted)]">
				Подпись (необязательно)
				<input
					class="field mt-1"
					type="text"
					maxlength="80"
					placeholder="например: без рывка, локти внутрь"
					bind:value={title}
					disabled={busy}
				/>
			</label>

			{#if busy || progress}
				<div class="space-y-1">
					<div class="h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
						<div
							class="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-200"
							style={`width: ${Math.round(progressRatio * 100)}%`}
						></div>
					</div>
					<p class="text-xs text-[var(--color-muted)]">{progress || 'Обработка…'}</p>
				</div>
			{/if}

			{#if previewUrl}
				<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
					<img
						src={previewUrl}
						alt="Превью GIF"
						class="h-40 w-40 rounded-lg border border-[var(--color-border)] bg-black object-contain"
					/>
					<div class="flex flex-1 flex-col gap-2">
						<button type="button" class="btn-primary" disabled={busy} onclick={publish}>
							Опубликовать GIF
						</button>
						<button type="button" class="btn-secondary" disabled={busy} onclick={clearPreview}>
							Сбросить
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if loading}
		<p class="text-sm text-[var(--color-muted)]">Загрузка клипов…</p>
	{:else if clips.length === 0}
		<p class="text-sm text-[var(--color-muted)]">Пока никто не делился техникой для этого упражнения.</p>
	{:else}
		<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each clips as clip (clip.id)}
				<li class="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
					<img
						src={clip.gifUrl}
						alt={clip.title || 'Техника'}
						class="aspect-square w-full bg-[var(--color-surface-muted)] object-contain"
						loading="lazy"
					/>
					<div class="space-y-2 p-3">
						<div>
							<p class="font-semibold leading-snug">{clip.title || 'Техника'}</p>
							<p class="text-xs text-[var(--color-muted)]">
								{clip.authorLabel} · {formatDate(clip.createdAt)}
							</p>
						</div>
						<div class="grid grid-cols-2 gap-2">
							<button type="button" class="btn-secondary text-sm" onclick={() => void shareClip(clip)}>
								Ссылка
							</button>
							<button type="button" class="btn-secondary text-sm" onclick={() => void shareGif(clip)}>
								GIF URL
							</button>
							{#if currentUserId === clip.userId}
								<button
									type="button"
									class="btn-ghost col-span-2 text-sm text-red-700"
									onclick={() => void removeClip(clip)}
								>
									Удалить
								</button>
							{/if}
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
