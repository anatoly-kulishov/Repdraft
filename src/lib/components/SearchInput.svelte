<script lang="ts">
	let {
		value = $bindable(''),
		placeholder = 'Поиск упражнений…',
		onchange
	}: {
		value?: string;
		placeholder?: string;
		onchange?: (value: string) => void;
	} = $props();

	let local = $state(value);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		local = value;
	});

	function onInput(event: Event) {
		const next = (event.currentTarget as HTMLInputElement).value;
		local = next;
		clearTimeout(timer);
		timer = setTimeout(() => {
			value = next;
			onchange?.(next);
		}, 150);
	}
</script>

<label class="block w-full">
	<span class="sr-only">Поиск</span>
	<input
		type="search"
		class="field w-full"
		{placeholder}
		bind:value={local}
		oninput={onInput}
	/>
</label>
