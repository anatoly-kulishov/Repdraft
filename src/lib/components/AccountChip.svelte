<script lang="ts">
	import { page } from '$app/stores';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';

	let {
		active = false
	}: {
		active?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let email = $derived($auth.user?.email ?? null);
	let initials = $derived(email ? initialsFromEmail(email) : null);
	let ariaLabel = $derived(
		!$auth.ready
			? translate(lang, 'common.loading')
			: !$auth.configured
				? translate(lang, 'nav.account')
				: email
					? email
					: translate(lang, 'nav.signIn')
	);
	let href = $derived(
		(() => {
			const path = $page.url.pathname;
			if (path === '/auth' || path.startsWith('/auth/')) return '/auth';
			const next = path + $page.url.search;
			return `/auth?next=${encodeURIComponent(next)}`;
		})()
	);

	function initialsFromEmail(value: string): string {
		const local = value.split('@')[0] ?? '?';
		const parts = local.split(/[._\-+]/).filter(Boolean);
		if (parts.length >= 2) {
			return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
		}
		return local.slice(0, 2).toUpperCase() || '?';
	}
</script>

<a
	class="account-chip"
	class:is-active={active}
	{href}
	aria-label={ariaLabel}
	title={email ?? ariaLabel}
>
	{#if !$auth.ready}
		<span class="account-avatar is-skeleton" aria-hidden="true"></span>
	{:else if email && initials}
		<span class="account-avatar" aria-hidden="true">{initials}</span>
	{:else}
		<span class="account-avatar is-guest" aria-hidden="true">
			<svg viewBox="0 0 24 24" class="h-4 w-4">
				<path
					d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z"
					fill="currentColor"
				/>
			</svg>
		</span>
	{/if}
</a>
