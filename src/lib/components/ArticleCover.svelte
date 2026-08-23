<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import type { Article } from '$lib/domain/articles';
	import { resolveArticleCoverIcon } from '$lib/domain/articles';
	import type { Component } from 'svelte';
	import { BookOpen, ClipboardList, Dumbbell, Flame, Library, Play, Timer } from '@lucide/svelte';

	const COVER_ICONS = {
		'book-open': BookOpen,
		timer: Timer,
		dumbbell: Dumbbell,
		play: Play,
		'clipboard-list': ClipboardList,
		library: Library,
		flame: Flame
	} satisfies Record<string, Component<{ size?: number | string; strokeWidth?: number | string }>>;

	let {
		article,
		variant = 'card',
		compact = false
	}: {
		article: Article;
		variant?: 'card' | 'hero';
		compact?: boolean;
	} = $props();

	let tone = $derived(article.coverTone ?? 'lime');
	let iconKey = $derived(resolveArticleCoverIcon(article));
	let CoverIcon = $derived(COVER_ICONS[iconKey]);
	let iconSize = $derived(compact ? 28 : variant === 'hero' ? 44 : 36);
</script>

<div
	class="article-cover"
	class:article-cover--compact={compact}
	class:article-cover--hero={variant === 'hero'}
	data-tone={tone}
	aria-hidden="true"
>
	<LucideIcon icon={CoverIcon} size={iconSize} class="article-cover__icon" strokeWidth={1.85} />
</div>
