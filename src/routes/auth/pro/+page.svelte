<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import ProBillingPanel from '$lib/components/billing/ProBillingPanel.svelte';
	import ProfileSettingsPage from '$lib/components/profile/ProfileSettingsPage.svelte';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);

	$effect(() => {
		if (!$auth.ready || !$auth.sessionKnown) return;
		if (!$auth.user) {
			void goto(`/auth?next=${encodeURIComponent('/auth/pro')}`, { replaceState: true });
		}
	});
</script>

<ProfileSettingsPage title={translate(lang, 'billing.title')}>
	{#if $auth.user}
		<ProBillingPanel />
	{:else}
		<p class="profile-settings-group__hint">{translate(lang, 'billing.needAuth')}</p>
	{/if}
</ProfileSettingsPage>
