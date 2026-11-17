<script lang="ts" generics="T extends { id: string; label: string }">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils.js';

	type Props = {
		items: T[];
		open?: boolean;
		triggerLabel: string;
		onSelect?: (item: T) => void;
		/** Trigger icon. */
		trigger?: Snippet;
		/** Item icon. */
		item?: Snippet<[T]>;
		class?: string;
	};

	let {
		items,
		open = $bindable(false),
		triggerLabel,
		onSelect,
		trigger,
		item,
		class: className = ''
	}: Props = $props();

	const uid = $props.id();
	const filterId = `${uid}-morph`;
	const BLOB = 48;
	const STEP = 60;
	const height = $derived(BLOB + items.length * STEP);

	function select(entry: T) {
		open = false;
		onSelect?.(entry);
	}
</script>

<div
	class={cn('fx-morph', open && 'is-open', className)}
	style={`--fx-morph-count:${items.length}`}
>
	<svg
		class="fx-morph__svg"
		width={BLOB + 32}
		height={height + 32}
		viewBox={`-16 ${-height + BLOB - 16} ${BLOB + 32} ${height + 32}`}
		aria-hidden="true"
		focusable="false"
	>
		<defs>
			<filter id={filterId} x="-50%" y="-20%" width="200%" height="140%">
				<feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
				<feColorMatrix
					in="blur"
					mode="matrix"
					values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
				/>
			</filter>
		</defs>
		<g filter={`url(#${filterId})`}>
			{#each items as entry, i (entry.id)}
				<circle
					class="fx-morph__blob"
					cx={BLOB / 2}
					cy={BLOB / 2}
					r={BLOB / 2 - 2}
					style={`--fx-morph-y:${-(i + 1) * STEP}px;--fx-morph-i:${i}`}
				/>
			{/each}
			<circle cx={BLOB / 2} cy={BLOB / 2} r={BLOB / 2} />
		</g>
	</svg>

	{#each items as entry, i (entry.id)}
		<button
			type="button"
			class="fx-morph__item"
			style={`--fx-morph-y:${-(i + 1) * STEP}px;--fx-morph-i:${i}`}
			tabindex={open ? 0 : -1}
			aria-hidden={!open}
			onclick={() => select(entry)}
		>
			<span class="fx-morph__label">{entry.label}</span>
			<span class="fx-morph__icon" aria-hidden="true">{@render item?.(entry)}</span>
		</button>
	{/each}

	<button
		type="button"
		class="fx-morph__trigger"
		aria-label={triggerLabel}
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		{@render trigger?.()}
	</button>
</div>
