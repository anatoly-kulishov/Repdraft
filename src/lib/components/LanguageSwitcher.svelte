<script lang="ts">
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);

	function onChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value as AppLocale;
		resolvedLocale.set(value);
	}
</script>

<label class="field-label">
	{translate(lang, 'lang.label')}
	<select
		class="field mt-1"
		aria-label={translate(lang, 'lang.label')}
		value={lang}
		onchange={onChange}
	>
		<option value="ru">{translate(lang, 'lang.ru')}</option>
		<option value="en">{translate(lang, 'lang.en')}</option>
	</select>
</label>
