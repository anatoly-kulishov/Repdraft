<script lang="ts">
	import { pathWithSearch } from '$lib/navigation/urlSearchParams';
	import { page } from '$app/stores';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { userAvatarUrl, userInitials } from '$lib/domain/authFlow';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { UserRound } from '@lucide/svelte';

	let {
		active = false
	}: {
		active?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let email = $derived($auth.user?.email ?? null);
	let avatarUrl = $derived(userAvatarUrl($auth.user));
	let avatarBroken = $state(false);
	let showPhoto = $derived(Boolean(avatarUrl) && !avatarBroken);
	let initials = $derived(userInitials($auth.user));
	let ariaLabel = $derived(
		!$auth.ready || !$auth.sessionKnown
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
			const next = pathWithSearch($page.url);
			return `/auth?next=${encodeURIComponent(next)}`;
		})()
	);

	$effect(() => {
		avatarUrl;
		avatarBroken = false;
	});
</script>

<a
	class="account-chip"
	class:is-active={active}
	{href}
	aria-label={ariaLabel}
	title={email ?? ariaLabel}
>
	{#if !$auth.ready || !$auth.sessionKnown}
		<span class="account-avatar is-skeleton" aria-hidden="true"></span>
	{:else if showPhoto && avatarUrl}
		<img
			class="account-avatar is-photo"
			src={avatarUrl}
			alt=""
			width="32"
			height="32"
			referrerpolicy="no-referrer"
			decoding="async"
			aria-hidden="true"
			onerror={() => {
				avatarBroken = true;
			}}
		/>
	{:else if email && initials}
		<span class="account-avatar" aria-hidden="true">{initials}</span>
	{:else}
		<span class="account-avatar is-guest" aria-hidden="true">
			<LucideIcon icon={UserRound} size={ICON_SMALL} />
		</span>
	{/if}
</a>
