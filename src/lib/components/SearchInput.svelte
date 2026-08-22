<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_INPUT } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Search, X } from '@lucide/svelte';

	let {
		value = $bindable(''),
		placeholder = '',
		debounceMs = 180,
		showClear = true,
		onchange
	}: {
		value?: string;
		placeholder?: string;
		/** Typing delay before parent filter runs (catalog list is heavy). */
		debounceMs?: number;
		/** Hide when parent supplies its own reset control (e.g. catalog FilterBar). */
		showClear?: boolean;
		onchange?: (value: string) => void;
	} = $props();

	let local = $state(value);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let lang = $derived($resolvedLocale);
	let canClear = $derived(showClear && local.trim().length > 0);

	$effect(() => {
		local = value;
	});

	function commit(next: string) {
		value = next;
		onchange?.(next);
	}

	function onInput(event: Event) {
		const next = (event.currentTarget as HTMLInputElement).value;
		local = next;
		clearTimeout(timer);
		timer = setTimeout(() => commit(next), debounceMs);
	}

	function clear() {
		clearTimeout(timer);
		local = '';
		commit('');
	}
</script>

<label class="relative block w-full min-w-0">
	<span class="search-input-icon" aria-hidden="true">
		<LucideIcon icon={Search} size={ICON_INPUT} />
	</span>
	<span class="sr-only">{placeholder}</span>
	<input
		type="text"
		inputmode="search"
		class="field search-field w-full search-field-with-icon"
		class:has-clear={canClear}
		{placeholder}
		autocomplete="off"
		autocapitalize="off"
		autocorrect="off"
		spellcheck="false"
		enterkeyhint="search"
		bind:value={local}
		oninput={onInput}
	/>
	{#if canClear}
		<button
			type="button"
			class="clear-btn"
			onclick={clear}
			aria-label={translate(lang, 'a11y.clearSearch')}
			title={translate(lang, 'a11y.clearSearch')}
		>
			<LucideIcon icon={X} size={ICON_INPUT} />
		</button>
	{/if}
</label>

<style>
	.search-field::-webkit-search-cancel-button {
		-webkit-appearance: none;
		appearance: none;
	}

	/* Beat .field { padding: … } so text never sits under the × */
	.search-field.has-clear {
		padding-right: 2.5rem;
	}

	.search-field-with-icon {
		padding-left: 2.65rem;
	}

	.search-input-icon {
		position: absolute;
		left: 0.85rem;
		top: 50%;
		display: flex;
		transform: translateY(-50%);
		color: var(--color-muted);
		pointer-events: none;
	}

	.clear-btn {
		position: absolute;
		top: 0;
		bottom: 0;
		right: 0.35rem;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 1.85rem;
		height: 1.85rem;
		margin-block: auto;
		padding: 0;
		border: 0;
		border-radius: 9999px;
		background: transparent;
		color: var(--color-muted);
		line-height: 0;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
	}

	/* Keep ≥44px tap without making the visible disc taller than the field. */
	.clear-btn::before {
		content: '';
		position: absolute;
		inset: -0.55rem;
	}

	.clear-btn:hover {
		background: var(--color-surface-muted);
		color: var(--color-ink);
	}
</style>
