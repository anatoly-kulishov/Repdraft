<script lang="ts">
	import ProfileSettingsPage from '$lib/components/profile/ProfileSettingsPage.svelte';
	import ProfileTrainingSettings from '$lib/components/profile/ProfileTrainingSettings.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
</script>

<ProfileSettingsPage title={translate(lang, 'settings.trainingProfileTitle')}>
	<ProfileTrainingSettings />
</ProfileSettingsPage>
