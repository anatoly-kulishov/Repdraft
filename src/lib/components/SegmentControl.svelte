<script lang="ts">
	export type SegmentOption<T extends string = string> = {
		id: T;
		label: string;
	};

	let {
		options,
		value,
		onchange,
		ariaLabel,
		size = 'default'
	}: {
		options: SegmentOption[];
		value: string;
		onchange: (id: string) => void;
		ariaLabel: string;
		/** Compact pill for place / short 2-option toggles. */
		size?: 'default' | 'compact';
	} = $props();
</script>

<div
	class="segment-control"
	class:segment-control--compact={size === 'compact'}
	style:--segment-count={options.length}
	role="tablist"
	aria-label={ariaLabel}
>
	{#each options as option (option.id)}
		<button
			type="button"
			class="segment-control__tab"
			class:is-active={value === option.id}
			role="tab"
			aria-selected={value === option.id}
			aria-label={option.label}
			onclick={() => onchange(option.id)}
		>
			{option.label}
		</button>
	{/each}
</div>
