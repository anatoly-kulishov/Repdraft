<script lang="ts">
	import { page } from '$app/stores';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { dayGreetingPeriod, homeGreetingMessageKey } from '$lib/domain/greeting';
	import { greetingFirstName } from '$lib/domain/greetingName';
	import { userAvatarUrl, userInitials } from '$lib/domain/authFlow';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { greetingName } from '$lib/stores/greetingName';
	import { resolvedLocale } from '$lib/stores/locale';
	import { UserRound } from '@lucide/svelte';

	let lang = $derived($resolvedLocale);
	let email = $derived($auth.user?.email ?? null);
	let avatarUrl = $derived(userAvatarUrl($auth.user));
	let avatarBroken = $state(false);
	let showPhoto = $derived(Boolean(avatarUrl) && !avatarBroken);
	let initials = $derived(userInitials($auth.user));
	let isGuest = $derived($auth.ready && $auth.configured && !$auth.user);
	let firstName = $derived(greetingFirstName($greetingName, $auth.user));

	let greetingText = $derived.by(() => {
		const period = dayGreetingPeriod();
		const withName = Boolean(firstName) && !isGuest;
		const key = homeGreetingMessageKey(period, withName);
		return withName && firstName
			? translate(lang, key, { name: firstName })
			: translate(lang, key);
	});

	let href = $derived(
		(() => {
			const path = $page.url.pathname;
			if (path === '/auth' || path.startsWith('/auth/')) return '/auth';
			const next = path + $page.url.search;
			return `/auth?next=${encodeURIComponent(next)}`;
		})()
	);

	$effect(() => {
		avatarUrl;
		avatarBroken = false;
	});
</script>

<a class="shell-home-greeting" {href}>
	{#if !$auth.ready}
		<span class="account-avatar is-skeleton shell-home-greeting__avatar" aria-hidden="true"></span>
		<span class="shell-home-greeting__copy">
			<span class="shell-home-greeting__line shell-home-greeting__line--skeleton" aria-hidden="true"></span>
		</span>
	{:else if showPhoto && avatarUrl}
		<img
			class="account-avatar is-photo shell-home-greeting__avatar"
			src={avatarUrl}
			alt=""
			width="40"
			height="40"
			referrerpolicy="no-referrer"
			decoding="async"
			aria-hidden="true"
			onerror={() => {
				avatarBroken = true;
			}}
		/>
	{:else if email && initials}
		<span class="account-avatar shell-home-greeting__avatar" aria-hidden="true">{initials}</span>
	{:else}
		<span class="account-avatar is-guest shell-home-greeting__avatar" aria-hidden="true">
			<LucideIcon icon={UserRound} size={ICON_SMALL} />
		</span>
	{/if}
	<span class="shell-home-greeting__copy">
		{#if $auth.ready}
			<span class="shell-home-greeting__line">{greetingText}</span>
		{:else}
			<span class="shell-home-greeting__line shell-home-greeting__line--skeleton" aria-hidden="true"></span>
		{/if}
	</span>
</a>
