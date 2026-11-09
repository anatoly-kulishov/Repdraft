<script lang="ts">
	import AuthInterfacePrefs from '$lib/components/AuthInterfacePrefs.svelte';
	import ProfileSettingsPage from '$lib/components/profile/ProfileSettingsPage.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
</script>

<ProfileSettingsPage title={translate(lang, 'settings.interfaceTitle')}>
	<AuthInterfacePrefs surface="panel" />
</ProfileSettingsPage>
