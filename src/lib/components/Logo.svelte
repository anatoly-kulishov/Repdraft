<script lang="ts">
	import mark from '$lib/assets/logo-mark.svg';

	let {
		size = 'md'
	}: {
		size?: 'sm' | 'md' | 'lg';
	} = $props();

	let markClass = $derived(
		size === 'lg' ? 'h-9 w-9' : size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'
	);
	let textClass = $derived(
		size === 'lg'
			? 'text-[1.65rem] tracking-[-0.03em]'
			: size === 'sm'
				? 'text-[1.15rem] tracking-[-0.02em]'
				: 'text-[1.35rem] tracking-[-0.025em] md:text-[1.5rem]'
	);
</script>

<a
	href="/"
	class="group inline-flex items-center gap-2.5 text-[var(--color-ink)] no-underline"
	aria-label="Repdraft — на главную"
>
	<img
		src={mark}
		alt=""
		width="32"
		height="32"
		class={`${markClass} shrink-0 rounded-[0.55rem] shadow-[0_1px_0_rgb(15_118_110/0.25)] transition-transform duration-200 group-hover:scale-[1.03]`}
	/>
	<span class={`font-[family-name:var(--font-body)] font-bold leading-none ${textClass}`}>
		Repdraft
	</span>
</a>
