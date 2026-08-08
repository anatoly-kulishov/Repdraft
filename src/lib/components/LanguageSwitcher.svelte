<script lang="ts">
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		compact = false
	}: {
		compact?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);

	function onChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value as AppLocale;
		resolvedLocale.set(value);
	}
</script>

<label class={compact ? 'inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]' : 'field-label'}>
	{#if !compact}
		{translate(lang, 'lang.label')}
	{/if}
	<select
		class={compact ? 'field !min-h-9 !w-auto !py-1.5 !text-sm' : 'field mt-1'}
		aria-label={translate(lang, 'lang.label')}
		value={lang}
		onchange={onChange}
	>
		<option value="ru">{translate(lang, 'lang.ru')}</option>
		<option value="en">{translate(lang, 'lang.en')}</option>
	</select>
</label>
