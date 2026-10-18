<script lang="ts">
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { BarChart3, Bot } from '@lucide/svelte';

	let lang = $derived($resolvedLocale);
</script>

<div class="profile-settings-group panel">
	<p class="profile-settings-group__title">{translate(lang, 'progress.sectionTitle')}</p>
	<ProfileSettingsRow
		icon={BarChart3}
		label={translate(lang, 'nav.progress')}
		href="/progress"
	/>
	<ProfileSettingsRow icon={Bot} label={translate(lang, 'nav.coach')} href="/coach" />
</div>
