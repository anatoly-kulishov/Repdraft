<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		value = $bindable(''),
		placeholder = '',
		onchange
	}: {
		value?: string;
		placeholder?: string;
		onchange?: (value: string) => void;
	} = $props();

	let local = $state(value);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let lang = $derived($resolvedLocale);
	let canClear = $derived(local.trim().length > 0);

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
		timer = setTimeout(() => commit(next), 150);
	}

	function clear() {
		clearTimeout(timer);
		local = '';
		commit('');
	}
</script>

<label class="relative block w-full min-w-0">
	<span class="sr-only">{placeholder}</span>
	<input
		type="search"
		class="field search-field w-full"
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
		>
			×
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
		padding-right: 2.85rem;
	}

	.clear-btn {
		position: absolute;
		right: 0.25rem;
		top: 50%;
		display: flex;
		height: 2.5rem;
		width: 2.5rem;
		min-height: 44px;
		min-width: 44px;
		transform: translateY(-50%);
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		border: 0;
		background: transparent;
		font-size: 1.25rem;
		line-height: 1;
		color: var(--color-muted);
		cursor: pointer;
	}

	.clear-btn:hover {
		background: var(--color-surface-muted);
		color: var(--color-ink);
	}
</style>
