<script lang="ts">
	import AppLabel from '$lib/components/AppLabel.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);

	function onChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value as AppLocale;
		resolvedLocale.set(value);
	}
</script>

<AppLabel>
	{translate(lang, 'lang.label')}
	<AppSelect class="mt-1" aria-label={translate(lang, 'lang.label')} value={lang} onchange={onChange}>
		<option value="ru">{translate(lang, 'lang.ru')}</option>
		<option value="en">{translate(lang, 'lang.en')}</option>
	</AppSelect>
</AppLabel>
