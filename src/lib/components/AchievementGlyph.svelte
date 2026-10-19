<script lang="ts">
	import { Flame, Medal, Target, Trophy, Zap } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import {
		achievementGlyph,
		type AchievementIconName,
		type AchievementId
	} from '$lib/domain/achievements';

	const ICONS = {
		flame: Flame,
		medal: Medal,
		trophy: Trophy,
		target: Target,
		zap: Zap
	} as const satisfies Record<
		AchievementIconName,
		Component<{ size?: number | string; strokeWidth?: number | string }>
	>;

	let { id, size = 36, dim = false }: { id: AchievementId; size?: number; dim?: boolean } = $props();

	let spec = $derived(achievementGlyph(id));
	let icon = $derived(ICONS[spec.icon]);
</script>

<span
	class="ach-glyph"
	class:ach-glyph--dim={dim}
	style:width="{size}px"
	style:height="{size}px"
	style:background-color={spec.color}
	style:--ach-glyph={spec.color}
	aria-hidden="true"
>
	<LucideIcon {icon} size={Math.round(size * 0.52)} strokeWidth={2.25} />
</span>

<style>
	.ach-glyph {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		color: #fff;
		box-shadow: 0 4px 12px color-mix(in srgb, var(--ach-glyph) 42%, transparent);
	}

	.ach-glyph--dim {
		opacity: 0.42;
		box-shadow: none;
	}

	.ach-glyph :global(svg) {
		display: block;
		stroke: #fff;
	}
</style>
