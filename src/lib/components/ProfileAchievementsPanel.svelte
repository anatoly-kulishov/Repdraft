<script lang="ts">
	import AchievementsPanel from '$lib/components/AchievementsPanel.svelte';
	import AppButton from '$lib/components/AppButton.svelte';
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import { countableFinishedSessions } from '$lib/domain/achievements';
	import { translate } from '$lib/i18n/messages';
	import { achievementsEnabled, achievementsState } from '$lib/stores/achievements';
	import { live } from '$lib/stores/live';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Trophy } from '@lucide/svelte';

	let lang = $derived($resolvedLocale);
	let finished = $derived(countableFinishedSessions($live.history));
</script>

<div class="profile-settings-group panel profile-settings-stack-full text-left">
	<p class="profile-settings-group__title">{translate(lang, 'achievements.title')}</p>
	<ProfileSettingsRow icon={Trophy} label={translate(lang, 'achievements.toggle')}>
		<input
			type="checkbox"
			class="auth-pref-toggle__input profile-settings-row__toggle"
			checked={$achievementsEnabled}
			aria-label={translate(lang, 'achievements.toggle')}
			onchange={(e) => {
				achievementsEnabled.set((e.currentTarget as HTMLInputElement).checked);
			}}
		/>
	</ProfileSettingsRow>
	<p class="profile-settings-group__hint">{translate(lang, 'achievements.hint')}</p>
	{#if $achievementsEnabled}
		<AchievementsPanel state={$achievementsState} finishedSessions={finished} showFilters />
		<AppButton variant="secondary" block href="/achievements" class="mt-3">
			{translate(lang, 'achievements.viewAll')}
		</AppButton>
	{/if}
</div>
