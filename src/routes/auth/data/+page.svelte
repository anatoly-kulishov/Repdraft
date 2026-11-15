<script lang="ts">
	import DataExportSection from '$lib/components/DataExportSection.svelte';
	import LoopMetricsPanel from '$lib/components/LoopMetricsPanel.svelte';
	import ProfileDevWipePanel from '$lib/components/ProfileDevWipePanel.svelte';
	import ProfileSettingsPage from '$lib/components/profile/ProfileSettingsPage.svelte';
	import ProfileSettingsSection from '$lib/components/profile/ProfileSettingsSection.svelte';
	import { testerToolsVisible } from '$lib/domain/prefs';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { testerModeEnabled } from '$lib/stores/prefs';

	let lang = $derived($resolvedLocale);
	let showTesterTools = $derived(
		testerToolsVisible({ pref: $testerModeEnabled, dev: import.meta.env.DEV })
	);
</script>

<ProfileSettingsPage title={translate(lang, 'settings.exportTitle')}>
	<ProfileSettingsSection
		class="profile-settings-group--data"
		hint={translate(lang, 'settings.exportHint')}
	>
		<DataExportSection embedded />
	</ProfileSettingsSection>
	{#if showTesterTools}
		<LoopMetricsPanel />
		<ProfileDevWipePanel />
	{/if}
</ProfileSettingsPage>
