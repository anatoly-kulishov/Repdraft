<script lang="ts">
	import { onDestroy } from 'svelte';
	import { cn } from '$lib/utils.js';

	type Props = {
		playLabel: string;
		stopLabel: string;
		/** Accessible name of the draggable source. */
		sourceLabel: string;
		class?: string;
	};

	let { playLabel, stopLabel, sourceLabel, class: className = '' }: Props = $props();

	/** Source position in -1..1 (x: left/right, y: front/back, listener at 0,0). */
	let pos = $state({ x: 0.45, y: -0.4 });
	let playing = $state(false);
	let padEl: HTMLDivElement | null = $state(null);

	type Graph = {
		ctx: AudioContext;
		osc: OscillatorNode;
		lfo: OscillatorNode;
		syllable: OscillatorNode;
		panner: StereoPannerNode;
		distance: GainNode;
		muffle: BiquadFilterNode;
	};
	let graph: Graph | null = null;

	function build(): Graph {
		const ctx = new AudioContext();
		const osc = ctx.createOscillator();
		osc.type = 'sawtooth';
		osc.frequency.value = 150;

		const lfo = ctx.createOscillator();
		lfo.frequency.value = 5.5;
		const lfoDepth = ctx.createGain();
		lfoDepth.gain.value = 6;
		lfo.connect(lfoDepth).connect(osc.frequency);

		const formants = [700, 1150, 2600].map((f, i) => {
			const bp = ctx.createBiquadFilter();
			bp.type = 'bandpass';
			bp.frequency.value = f;
			bp.Q.value = 9;
			const g = ctx.createGain();
			g.gain.value = [1, 0.6, 0.25][i];
			osc.connect(bp).connect(g);
			return g;
		});

		const envelope = ctx.createGain();
		envelope.gain.value = 0.5;
		const syllable = ctx.createOscillator();
		syllable.frequency.value = 3.6;
		const syllableDepth = ctx.createGain();
		syllableDepth.gain.value = 0.5;
		syllable.connect(syllableDepth).connect(envelope.gain);
		formants.forEach((g) => g.connect(envelope));

		const muffle = ctx.createBiquadFilter();
		muffle.type = 'lowpass';
		const distance = ctx.createGain();
		const panner = ctx.createStereoPanner();
		envelope.connect(muffle).connect(distance).connect(panner).connect(ctx.destination);

		osc.start();
		lfo.start();
		syllable.start();
		return { ctx, osc, lfo, syllable, panner, distance, muffle };
	}

	function applyPosition() {
		if (!graph) return;
		const t = graph.ctx.currentTime;
		const d = Math.min(1.2, Math.hypot(pos.x, pos.y));
		graph.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pos.x * 1.1)), t, 0.04);
		graph.distance.gain.setTargetAtTime(0.9 / (1 + d * d * 4), t, 0.05);
		const behind = Math.max(0, pos.y);
		graph.muffle.frequency.setTargetAtTime(9000 - behind * 7800, t, 0.06);
	}

	$effect(() => {
		void pos.x;
		void pos.y;
		applyPosition();
	});

	async function toggle() {
		if (playing) {
			await graph?.ctx.suspend();
			playing = false;
			return;
		}
		graph ??= build();
		applyPosition();
		await graph.ctx.resume();
		playing = true;
	}

	function setFromPointer(e: PointerEvent) {
		if (!padEl) return;
		const r = padEl.getBoundingClientRect();
		const clamp = (v: number) => Math.max(-1, Math.min(1, v));
		pos = {
			x: clamp(((e.clientX - r.left) / r.width) * 2 - 1),
			y: clamp(((e.clientY - r.top) / r.height) * 2 - 1)
		};
	}

	function onKey(e: KeyboardEvent) {
		const step = e.shiftKey ? 0.25 : 0.1;
		const clamp = (v: number) => Math.max(-1, Math.min(1, v));
		switch (e.key) {
			case 'ArrowLeft':
				pos = { ...pos, x: clamp(pos.x - step) };
				break;
			case 'ArrowRight':
				pos = { ...pos, x: clamp(pos.x + step) };
				break;
			case 'ArrowUp':
				pos = { ...pos, y: clamp(pos.y - step) };
				break;
			case 'ArrowDown':
				pos = { ...pos, y: clamp(pos.y + step) };
				break;
			default:
				return;
		}
		e.preventDefault();
	}

	onDestroy(() => {
		void graph?.ctx.close();
		graph = null;
	});
</script>

<div class={cn('fx-voice', playing && 'is-playing', className)}>
	<div
		class="fx-voice__pad"
		role="presentation"
		bind:this={padEl}
		onpointerdown={(e) => {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
			setFromPointer(e);
		}}
		onpointermove={(e) => {
			if (e.buttons) setFromPointer(e);
		}}
	>
		<span class="fx-voice__ring" style="--fx-voice-r:0.33" aria-hidden="true"></span>
		<span class="fx-voice__ring" style="--fx-voice-r:0.66" aria-hidden="true"></span>
		<span class="fx-voice__ring" style="--fx-voice-r:1" aria-hidden="true"></span>
		<span class="fx-voice__listener" aria-hidden="true"></span>
		<span
			class="fx-voice__source"
			role="slider"
			tabindex="0"
			aria-label={sourceLabel}
			aria-valuemin={-100}
			aria-valuemax={100}
			aria-valuenow={Math.round(pos.x * 100)}
			aria-valuetext={`${Math.round(pos.x * 100)}, ${Math.round(pos.y * 100)}`}
			style={`left:${(pos.x + 1) * 50}%;top:${(pos.y + 1) * 50}%`}
			onkeydown={onKey}
		>
			<span class="fx-voice__wave" aria-hidden="true"></span>
		</span>
	</div>
	<button type="button" class="btn-secondary fx-voice__toggle" onclick={toggle}>
		{playing ? stopLabel : playLabel}
	</button>
</div>
