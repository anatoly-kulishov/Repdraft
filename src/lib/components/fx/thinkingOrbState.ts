export const THINKING_ORB_STATES = [
	'working',
	'searching',
	'solving',
	'listening',
	'connecting',
	'weaving',
	'composing',
	'breathing',
	'shaping'
] as const;

export type ThinkingOrbState = (typeof THINKING_ORB_STATES)[number];
