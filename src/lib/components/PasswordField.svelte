<script lang="ts">
	import AppInput from '$lib/components/AppInput.svelte';
	import AppIconButton from '$lib/components/AppIconButton.svelte';
	import AppLabel from '$lib/components/AppLabel.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_INPUT } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Eye, EyeOff } from '@lucide/svelte';

	let {
		value = $bindable(''),
		label,
		placeholder,
		autocomplete = 'current-password',
		required = true,
		minlength = 6,
		name,
		invalid = false
	}: {
		value?: string;
		label: string;
		placeholder: string;
		autocomplete?: 'current-password' | 'new-password';
		required?: boolean;
		minlength?: number;
		name?: string;
		invalid?: boolean;
	} = $props();

	let visible = $state(false);
	let lang = $derived($resolvedLocale);
</script>

<AppLabel>
	{label}
	<div class="relative mt-1">
		<AppInput
			class="w-full pr-11"
			aria-invalid={invalid || undefined}
			type={visible ? 'text' : 'password'}
			{required}
			{minlength}
			{autocomplete}
			{name}
			{placeholder}
			bind:value
		/>
		<AppIconButton
			class="absolute inset-y-0 right-0 !min-h-0 !min-w-0 size-11 p-0 text-[var(--color-muted)]"
			onclick={() => (visible = !visible)}
			aria-pressed={visible}
			aria-label={translate(lang, visible ? 'auth.hidePassword' : 'auth.showPassword')}
		>
			{#if visible}
				<LucideIcon icon={EyeOff} size={ICON_INPUT} />
			{:else}
				<LucideIcon icon={Eye} size={ICON_INPUT} />
			{/if}
		</AppIconButton>
	</div>
</AppLabel>
