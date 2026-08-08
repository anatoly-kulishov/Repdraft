<script lang="ts">
	let {
		title,
		description,
		actionHref,
		actionLabel
	}: {
		title: string;
		description?: string;
		actionHref?: string;
		actionLabel?: string;
	} = $props();
</script>

<div class="panel-dashed flex flex-col items-start gap-3 py-8 text-left">
	<h2 class="section-title">{title}</h2>
	{#if description}
		<p class="max-w-md text-sm leading-relaxed text-[var(--color-muted)]">{description}</p>
	{/if}
	{#if actionHref && actionLabel}
		<a class="btn-primary mt-1" href={actionHref}>{actionLabel}</a>
	{/if}
</div>
