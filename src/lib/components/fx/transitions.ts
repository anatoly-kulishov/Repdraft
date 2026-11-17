import type { TransitionConfig } from 'svelte/transition';
import { prefersReducedMotion } from './motion';

type WaveParams = {
	duration?: number;
	/** Wave bulge as % of width. */
	amplitude?: number;
	/** Number of crests along the edge. */
	crests?: number;
	direction?: 'forward' | 'back';
};

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Incoming pane revealed by a moving wave front, with a slight drift. */
export function waveReveal(_node: Element, params: WaveParams = {}): TransitionConfig {
	if (prefersReducedMotion()) return { duration: 0 };
	const amplitude = params.amplitude ?? 7;
	const crests = params.crests ?? 2.2;
	const back = params.direction === 'back';
	const steps = 18;
	return {
		duration: params.duration ?? 560,
		easing: easeInOutCubic,
		css: (t) => {
			const front = t * (100 + amplitude * 2) - amplitude;
			const pts: string[] = [];
			for (let i = 0; i <= steps; i++) {
				const y = (i / steps) * 100;
				const bulge = amplitude * Math.sin((y / 100) * crests * Math.PI * 2 + t * Math.PI * 2);
				const x = Math.max(0, Math.min(100, front + bulge * (1 - t)));
				pts.push(`${back ? 100 - x : x}% ${y}%`);
			}
			const edge = back ? '100% 100%, 100% 0%' : '0% 100%, 0% 0%';
			const drift = (1 - t) * (back ? -18 : 18);
			return `z-index:2;clip-path:polygon(${pts.join(',')},${edge});transform:translateX(${drift}px);`;
		}
	};
}

/** Keep the outgoing pane under the wave until it finishes. */
export function holdUnder(_node: Element, params: { duration?: number } = {}): TransitionConfig {
	if (prefersReducedMotion()) return { duration: 0 };
	return {
		duration: params.duration ?? 560,
		css: (t) => `z-index:1;opacity:${0.55 + 0.45 * t};`
	};
}
