/** Browser camera capture for technique clips (MediaRecorder). */

export function pickRecorderMime(): string | undefined {
	if (typeof MediaRecorder === 'undefined') return undefined;
	for (const type of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) {
		if (MediaRecorder.isTypeSupported(type)) return type;
	}
	return undefined;
}

export async function acquireCamStream(): Promise<MediaStream> {
	try {
		return await navigator.mediaDevices.getUserMedia({
			video: { facingMode: { ideal: 'environment' } },
			audio: false
		});
	} catch {
		return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
	}
}

export type ClipCameraHandlers = {
	onTick: (seconds: number) => void;
	onCaptured: (file: File, durationSec: number) => void;
	onIdle: () => void;
};

/**
 * Owns MediaStream + MediaRecorder lifecycle for a single capture session.
 * Call `dispose()` on cancel / unmount.
 */
export function createClipCameraSession(
	stream: MediaStream,
	maxDurationSec: number,
	handlers: ClipCameraHandlers
) {
	let mediaRecorder: MediaRecorder | null = null;
	let tick: ReturnType<typeof setInterval> | undefined;
	let autoStop: ReturnType<typeof setTimeout> | undefined;
	let saveOnStop = false;
	let startedAt = 0;
	let disposed = false;

	function clearTimers() {
		if (tick) clearInterval(tick);
		if (autoStop) clearTimeout(autoStop);
		tick = undefined;
		autoStop = undefined;
	}

	function stopTracks() {
		stream.getTracks().forEach((t) => t.stop());
	}

	function start() {
		if (disposed || mediaRecorder) return;
		const mime = pickRecorderMime();
		const chunks: BlobPart[] = [];
		const rec = mime
			? new MediaRecorder(stream, { mimeType: mime })
			: new MediaRecorder(stream);
		mediaRecorder = rec;
		saveOnStop = true;
		startedAt = performance.now();

		rec.ondataavailable = (e) => {
			if (e.data.size > 0) chunks.push(e.data);
		};
		rec.onstop = () => {
			clearTimers();
			mediaRecorder = null;
			const shouldSave = saveOnStop;
			const elapsedSec = Math.max(0.4, (performance.now() - startedAt) / 1000);
			saveOnStop = false;
			stopTracks();
			handlers.onIdle();
			if (!shouldSave || chunks.length === 0 || disposed) return;
			const type = rec.mimeType || mime || 'video/webm';
			const ext = type.includes('mp4') ? 'mp4' : 'webm';
			handlers.onCaptured(
				new File([new Blob(chunks, { type })], `camera.${ext}`, { type }),
				elapsedSec
			);
		};

		rec.start(250);
		handlers.onTick(0);
		tick = setInterval(() => {
			handlers.onTick(
				Math.min(maxDurationSec, Math.floor((performance.now() - startedAt) / 1000))
			);
		}, 200);
		autoStop = setTimeout(() => stop(), maxDurationSec * 1000);
	}

	function stop() {
		if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
		saveOnStop = true;
		clearTimers();
		try {
			mediaRecorder.stop();
		} catch {
			/* ignore */
		}
	}

	function dispose() {
		disposed = true;
		clearTimers();
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			saveOnStop = false;
			try {
				mediaRecorder.stop();
			} catch {
				/* ignore */
			}
		}
		mediaRecorder = null;
		stopTracks();
		handlers.onIdle();
	}

	return { start, stop, dispose };
}
