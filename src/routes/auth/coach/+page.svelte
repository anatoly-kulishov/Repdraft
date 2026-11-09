<script lang="ts">
	import { goto } from '$app/navigation';
	import ProfileCoachSettings from '$lib/components/profile/ProfileCoachSettings.svelte';
	import ProfileSettingsPage from '$lib/components/profile/ProfileSettingsPage.svelte';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);

	$effect(() => {
		if (!$auth.ready || !$auth.sessionKnown) return;
		if (!$auth.user) {
			void goto('/auth', { replaceState: true });
		}
	});
</script>

<ProfileSettingsPage title={translate(lang, 'profile.clients')}>
	{#if $auth.user}
		<ProfileCoachSettings />
	{/if}
</ProfileSettingsPage>
