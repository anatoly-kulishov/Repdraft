<script lang="ts">
	import DataExportSection from '$lib/components/DataExportSection.svelte';
	import LoopMetricsPanel from '$lib/components/LoopMetricsPanel.svelte';
	import ProfileDevWipePanel from '$lib/components/ProfileDevWipePanel.svelte';
	import ProfileSettingsPage from '$lib/components/profile/ProfileSettingsPage.svelte';
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
	<div class="profile-settings-group panel profile-settings-group--data">
		<p class="profile-settings-group__title">{translate(lang, 'settings.exportTitle')}</p>
		<p class="profile-settings-group__hint">{translate(lang, 'settings.exportHint')}</p>
		<DataExportSection embedded />
	</div>
	{#if showTesterTools}
		<LoopMetricsPanel />
		<ProfileDevWipePanel />
	{/if}
</ProfileSettingsPage>
