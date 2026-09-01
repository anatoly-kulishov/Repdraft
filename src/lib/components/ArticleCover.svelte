<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import type { Article } from '$lib/domain/articles';
	import { resolveArticleCoverIcon } from '$lib/domain/articles';
	import type { Component } from 'svelte';
	import { BookOpen, ClipboardList, Dumbbell, Flame, History, Library, Play, Timer } from '@lucide/svelte';

	const COVER_ICONS = {
		'book-open': BookOpen,
		timer: Timer,
		dumbbell: Dumbbell,
		play: Play,
		'clipboard-list': ClipboardList,
		library: Library,
		flame: Flame,
		history: History
	} satisfies Record<string, Component<{ size?: number | string; strokeWidth?: number | string }>>;

	let { article }: { article: Article } = $props();

	let tone = $derived(article.coverTone ?? 'lime');
	let iconKey = $derived(resolveArticleCoverIcon(article));
	let CoverIcon = $derived(COVER_ICONS[iconKey]);
</script>

<div class="article-cover" data-tone={tone} aria-hidden="true">
	<LucideIcon icon={CoverIcon} size={22} class="article-cover__icon" strokeWidth={1.85} />
</div>
