<script lang="ts">
	import ProfileInsightsPanel from '$lib/components/ProfileInsightsPanel.svelte';
	import ProfileSettingsPage from '$lib/components/profile/ProfileSettingsPage.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
</script>

<ProfileSettingsPage title={translate(lang, 'progress.sectionTitle')}>
	<ProfileInsightsPanel />
</ProfileSettingsPage>
