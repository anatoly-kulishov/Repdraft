<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

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
				<!-- eye-off -->
				<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" aria-hidden="true">
					<path
						d="M3 3l18 18M10.5 10.7a2.5 2.5 0 0 0 3.3 3.3M9.9 5.6A10 10 0 0 1 12 5.3c5 0 8.5 4.2 9.7 6-.5.8-1.4 2-2.8 3.1M6.1 6.7C4.4 7.9 3.3 9.4 2.3 11.3c1.2 1.8 4.7 6 9.7 6 1.1 0 2.1-.2 3-.5"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			{:else}
				<!-- eye -->
				<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" aria-hidden="true">
					<path
						d="M2.3 12c1.2-1.8 4.7-6 9.7-6s8.5 4.2 9.7 6c-1.2 1.8-4.7 6-9.7 6s-8.5-4.2-9.7-6Z"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linejoin="round"
					/>
					<circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.75" />
				</svg>
			{/if}
		</button>
	</div>
</label>
