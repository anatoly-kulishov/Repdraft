<script lang="ts">
	import { isTextClamped } from '$lib/dom/isTextClamped';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { cn } from '$lib/utils.js';

	let {
		text,
		lines = 2,
		href = undefined as string | undefined,
		as = 'span' as 'span' | 'h1' | 'h2',
		id = undefined as string | undefined,
		class: className = '',
		titleAttr = true,
		onpointerdown = undefined as (() => void) | undefined
	}: {
		text: string;
		/** Max lines when collapsed (ignored while expanded). */
		lines?: number;
		/** When set, renders an anchor; first tap expands if truncated, next tap navigates. */
		href?: string;
		as?: 'span' | 'h1' | 'h2';
		id?: string;
		class?: string;
		/** Native tooltip with the full string (desktop / long-press). */
		titleAttr?: boolean;
		onpointerdown?: () => void;
	} = $props();

	let lang = $derived($resolvedLocale);
	let expanded = $state(false);
	let el = $state<HTMLElement | null>(null);
	let truncatable = $state(false);

	function remeasure() {
		const node = el;
		if (!node) return;
		if (expanded) {
			truncatable = true;
			return;
		}
		truncatable = isTextClamped(node);
	}

	$effect(() => {
		void text;
		void lines;
		void expanded;
		const id = requestAnimationFrame(() => remeasure());
		return () => cancelAnimationFrame(id);
	});

	function onActivate(e: MouseEvent) {
		if (!expanded && truncatable) {
			e.preventDefault();
			e.stopPropagation();
			expanded = true;
			return;
		}
		if (expanded && !href) {
			e.preventDefault();
			expanded = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		if (!truncatable && !expanded) return;
		e.preventDefault();
		expanded = !expanded;
	}
</script>

{#if href}
	<a
		{href}
		{id}
		bind:this={el}
		class={cn('expandable-text', className)}
		class:is-expanded={expanded}
		class:is-expandable={truncatable && !expanded}
		style:--expandable-lines={lines}
		title={titleAttr ? text : undefined}
		aria-expanded={truncatable || expanded ? expanded : undefined}
		aria-label={truncatable && !expanded
			? `${text}. ${translate(lang, 'a11y.expandTitle')}`
			: undefined}
		{onpointerdown}
		onclick={onActivate}
	>
		{text}
	</a>
{:else}
	<svelte:element
		this={as}
		{id}
		bind:this={el}
		class={cn('expandable-text', className)}
		class:is-expanded={expanded}
		class:is-expandable={truncatable && !expanded}
		style:--expandable-lines={lines}
		title={titleAttr ? text : undefined}
		role={truncatable || expanded ? 'button' : undefined}
		tabindex={truncatable || expanded ? 0 : undefined}
		aria-expanded={truncatable || expanded ? expanded : undefined}
		aria-label={truncatable && !expanded
			? `${text}. ${translate(lang, 'a11y.expandTitle')}`
			: undefined}
		{onpointerdown}
		onclick={onActivate}
		onkeydown={onKeydown}
	>
		{text}
	</svelte:element>
{/if}
