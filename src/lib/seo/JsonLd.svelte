<script lang="ts">
	interface Props {
		data: Record<string, unknown> | Record<string, unknown>[];
	}

	let { data }: Props = $props();

	let schemas = $derived(Array.isArray(data) ? data : [data]);
	let payloads = $derived(
		schemas.map((schema) =>
			JSON.stringify(schema).replace(/</g, '\\u003c')
		)
	);
</script>

<svelte:head>
	{#each payloads as payload (payload)}
		{@html `<script type="application/ld+json">${payload}<\/script>`}
	{/each}
</svelte:head>
