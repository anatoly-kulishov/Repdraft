<script lang="ts">
	import { goto } from '$app/navigation';
	import ProfileAccountSettings from '$lib/components/profile/ProfileAccountSettings.svelte';
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

<ProfileSettingsPage title={translate(lang, 'settings.accountTitle')}>
	{#if $auth.user}
		<ProfileAccountSettings />
	{/if}
</ProfileSettingsPage>
