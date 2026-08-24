<script lang="ts">
	import AppInput from '$lib/components/AppInput.svelte';
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
	<div class="password-field relative mt-1">
		<AppInput
			class="password-field__input w-full pr-12"
			aria-invalid={invalid || undefined}
			type={visible ? 'text' : 'password'}
			{required}
			{minlength}
			{autocomplete}
			{name}
			{placeholder}
			bind:value
		/>
		<button
			type="button"
			class="password-field__toggle"
			onclick={() => (visible = !visible)}
			aria-pressed={visible}
			aria-label={translate(lang, visible ? 'auth.hidePassword' : 'auth.showPassword')}
		>
			{#if visible}
				<LucideIcon icon={EyeOff} size={ICON_INPUT} />
			{:else}
				<LucideIcon icon={Eye} size={ICON_INPUT} />
			{/if}
		</button>
	</div>
</AppLabel>
