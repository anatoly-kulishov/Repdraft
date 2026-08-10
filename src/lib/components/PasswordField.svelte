<script lang="ts">
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
		name
	}: {
		value?: string;
		label: string;
		placeholder: string;
		autocomplete?: 'current-password' | 'new-password';
		required?: boolean;
		minlength?: number;
		name?: string;
	} = $props();

	let visible = $state(false);
	let lang = $derived($resolvedLocale);
</script>

<label class="field-label">
	{label}
	<div class="relative mt-1">
		<input
			class="field w-full pr-11"
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
			class="absolute inset-y-0 right-0 grid w-11 place-items-center text-[var(--color-muted)]"
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
</label>
