<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		checked = $bindable(false)
	}: {
		checked?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
</script>

<label class="auth-legal-consent">
	<input type="checkbox" class="auth-legal-consent__input" bind:checked />
	<span class="auth-legal-consent__text">
		{translate(lang, 'auth.legalConsentLead')}
		<a class="auth-legal-consent__link" href="/terms">{translate(lang, 'auth.legalTerms')}</a>
		{translate(lang, 'auth.legalConsentJoin')}
		<a class="auth-legal-consent__link" href="/privacy">{translate(lang, 'auth.legalPrivacy')}</a>
	</span>
</label>
