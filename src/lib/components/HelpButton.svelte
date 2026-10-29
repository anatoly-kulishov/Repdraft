<script lang="ts">
	import { Question } from 'phosphor-svelte';

	let {
		label,
		open = $bindable(false)
	}: {
		/** Accessible label, e.g. «Помощь» / «Help». */
		label: string;
		/** Two-way: pair with `<HelpPanel bind:open>`. */
		open?: boolean;
	} = $props();
</script>

<button
	type="button"
	class="help-btn"
	aria-label={label}
	aria-expanded={open}
	onclick={() => (open = !open)}
>
	<Question size={22} />
</button>
