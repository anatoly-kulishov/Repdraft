<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import type { Article } from '$lib/domain/articles';
	import { resolveArticleCoverIcon } from '$lib/domain/articles';
	import type { IconComponentProps } from 'phosphor-svelte';
	import type { Component } from 'svelte';
	import {
		BookOpen,
		ClipboardText as ClipboardList,
		Barbell as Dumbbell,
		Fire as Flame,
		ClockCounterClockwise as History,
		Books as Library,
		Play,
		Sparkle as Sparkles,
		Timer,
	} from 'phosphor-svelte';

	const COVER_ICONS = {
		'book-open': BookOpen,
		timer: Timer,
		dumbbell: Dumbbell,
		play: Play,
		'clipboard-list': ClipboardList,
		library: Library,
		flame: Flame,
		history: History,
		sparkles: Sparkles
	} satisfies Record<string, Component<IconComponentProps>>;

	let { article }: { article: Article } = $props();

	let tone = $derived(article.coverTone ?? 'lime');
	let iconKey = $derived(resolveArticleCoverIcon(article));
	let CoverIcon = $derived(COVER_ICONS[iconKey]);
</script>

<div class="article-cover" data-tone={tone} aria-hidden="true">
	<LucideIcon icon={CoverIcon} size={22} class="article-cover__icon" />
</div>
