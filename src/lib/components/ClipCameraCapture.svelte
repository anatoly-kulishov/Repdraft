<script lang="ts">
	import { acquireCamStream, createClipCameraSession } from '$lib/media/clipCamera';
	import { clipEncodeDurationSec } from '$lib/media/videoToGif';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { onDestroy } from 'svelte';

	let {
		open = $bindable(false),
		onCaptured,
		onUnavailable
	}: {
		open: boolean;
		onCaptured: (file: File, durationSec: number) => void;
		/** No getUserMedia / MediaRecorder — parent should fall back to file input. */
		onUnavailable?: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let videoEl = $state<HTMLVideoElement | undefined>();
	let recording = $state(false);
	let seconds = $state(0);
	let session: ReturnType<typeof createClipCameraSession> | null = null;
	let bootGen = 0;

	function tearDown() {
		session?.dispose();
		session = null;
		recording = false;
		seconds = 0;
		if (videoEl) videoEl.srcObject = null;
	}

	async function boot() {
		const gen = ++bootGen;
		tearDown();
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
			open = false;
			onUnavailable?.();
			return;
		}
		try {
			const stream = await acquireCamStream();
			if (gen !== bootGen || !open) {
				stream.getTracks().forEach((t) => t.stop());
				return;
			}
			session = createClipCameraSession(stream, clipEncodeDurationSec(), {
				onTick: (n) => {
					seconds = n;
				},
				onCaptured: (file, durationSec) => {
					recording = false;
					seconds = 0;
					session = null;
					open = false;
					onCaptured(file, durationSec);
				},
				onIdle: () => {
					recording = false;
					seconds = 0;
				}
			});
			queueMicrotask(() => {
				if (!videoEl || gen !== bootGen) return;
				videoEl.srcObject = stream;
				void videoEl.play();
			});
		} catch {
			open = false;
			onUnavailable?.();
		}
	}

	$effect(() => {
		if (open) {
			void boot();
		} else {
			bootGen += 1;
			tearDown();
		}
	});

	onDestroy(() => {
		bootGen += 1;
		tearDown();
	});

	function start() {
		if (!session || recording) return;
		recording = true;
		seconds = 0;
		session.start();
	}

	function stop() {
		session?.stop();
	}

	function cancel() {
		open = false;
	}
</script>

{#if open}
	<div
		class="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-black md:fixed md:bottom-6 md:right-6 md:top-20 md:z-[55] md:flex md:w-[min(28rem,calc(100vw-3rem))] md:flex-col md:shadow-[0_16px_48px_rgba(15,23,42,0.22)]"
	>
		<video
			bind:this={videoEl}
			class="mx-auto min-h-72 w-full flex-1 object-contain md:min-h-0"
			playsinline
			muted
			autoplay
		></video>
		<div class="flex flex-wrap items-center justify-center gap-2 bg-[var(--color-surface)] p-3">
			{#if recording}
				<p class="w-full text-center text-xs font-medium text-[var(--color-danger)]">
					{translate(lang, 'clips.camRecording', {
						n: `${seconds}/${clipEncodeDurationSec()}`
					})}
				</p>
				<button type="button" class="btn-primary text-sm" onclick={stop}>
					{translate(lang, 'clips.camStop')}
				</button>
			{:else}
				<p class="w-full text-center text-xs text-[var(--color-muted)]">
					{translate(lang, 'clips.camHint', { sec: clipEncodeDurationSec() })}
				</p>
				<button type="button" class="btn-primary text-sm" onclick={start}>
					{translate(lang, 'clips.camRecord')}
				</button>
			{/if}
			<button type="button" class="btn-ghost text-sm" onclick={cancel}>
				{translate(lang, 'clips.camCancel')}
			</button>
		</div>
	</div>
{/if}
