<script lang="ts">
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ChartBar, Robot } from 'phosphor-svelte';

	let lang = $derived($resolvedLocale);
</script>

<div class="profile-settings-group panel">
	<p class="profile-settings-group__title">{translate(lang, 'progress.sectionTitle')}</p>
	<ProfileSettingsRow
		icon={ChartBar}
		label={translate(lang, 'nav.progress')}
		href="/progress"
	/>
	<ProfileSettingsRow icon={Robot} label={translate(lang, 'nav.coach')} href="/coach" />
</div>
