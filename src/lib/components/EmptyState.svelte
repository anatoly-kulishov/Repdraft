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

<div
	class="flex flex-col items-start gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-8"
>
	<h2 class="font-[family-name:var(--font-display)] text-xl text-[var(--color-ink)]">{title}</h2>
	{#if description}
		<p class="max-w-md text-sm text-[var(--color-muted)]">{description}</p>
	{/if}
	{#if actionHref && actionLabel}
		<a class="btn-primary" href={actionHref}>{actionLabel}</a>
	{/if}
</div>
