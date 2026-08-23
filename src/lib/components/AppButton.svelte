<script lang="ts">
	import { Button, type ButtonProps } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	type AppButtonVariant = 'primary' | 'action' | 'secondary' | 'danger' | 'ghost' | 'link';

	type Props = Omit<ButtonProps, 'variant'> & {
		variant?: AppButtonVariant;
		block?: boolean;
	};

	let {
		variant = 'primary',
		block = false,
		class: className,
		children,
		...rest
	}: Props = $props();

	const shadcnVariant = $derived.by((): ButtonProps['variant'] => {
		switch (variant) {
			case 'primary':
			case 'action':
				return 'default';
			case 'secondary':
				return 'outline';
			case 'danger':
				return 'destructive';
			case 'ghost':
				return 'ghost';
			case 'link':
				return 'link';
			default: {
				const _exhaustive: never = variant;
				return _exhaustive;
			}
		}
	});
	const legacyBtnClass = $derived.by(() => {
		switch (variant) {
			case 'primary':
			case 'action':
				return variant === 'action' ? 'btn-action' : 'btn-primary';
			case 'secondary':
				return 'btn-secondary';
			case 'danger':
				return 'btn-danger';
			case 'ghost':
				return 'btn-ghost';
			case 'link':
				return 'btn-link';
			default: {
				const _exhaustive: never = variant;
				return _exhaustive;
			}
		}
	});
</script>

<Button
	variant={shadcnVariant}
	class={cn(legacyBtnClass, block && 'btn-block w-full', className)}
	{...rest}
>
	{@render children?.()}
</Button>
