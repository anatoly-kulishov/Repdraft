<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import ThemeToggleIcon from '$lib/components/ThemeToggleIcon.svelte';
	import { ICON_SIDEBAR } from '$lib/components/icons/sizes';
	import { userAvatarUrl, userInitials } from '$lib/domain/authFlow';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { draft, draftHydrated } from '$lib/stores/draft';
	import { appTheme } from '$lib/stores/theme';
	import { resolvedLocale } from '$lib/stores/locale';
	import { BookOpen, ClipboardList, Dumbbell, House, UserRound } from '@lucide/svelte';

	let {
		path,
		isActive,
		hasActiveSession = false
	}: {
		path: string;
		isActive: (href: string) => boolean;
		hasActiveSession?: boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let isLight = $derived($appTheme === 'light');
	let draftCount = $derived($draft.exercises.length);
	let showDraftNav = $derived($draftHydrated && draftCount > 0);
	let draftActive = $derived(path.startsWith('/builder'));
	let profileAvatar = $derived(userAvatarUrl($auth.user));
	let profileInitials = $derived(userInitials($auth.user));
	let profileAvatarBroken = $state(false);
	let showProfilePhoto = $derived(Boolean(profileAvatar) && !profileAvatarBroken);
	let profileSignedIn = $derived(Boolean($auth.ready && $auth.sessionKnown && $auth.user));

	$effect(() => {
		profileAvatar;
		profileAvatarBroken = false;
	});

	type NavItem = {
		href: string;
		labelKey: string;
		icon: typeof House;
		liveDot?: boolean;
	};

	const mainNav: NavItem[] = [
		{ href: '/', labelKey: 'nav.tabHome', icon: House },
		{ href: '/workouts', labelKey: 'nav.workouts', icon: Dumbbell, liveDot: true },
		{ href: '/exercises', labelKey: 'nav.exercises', icon: BookOpen }
	];
</script>

<aside class="shell-sidebar" aria-label={translate(lang, 'nav.main')}>
	<div class="shell-sidebar-brand">
		<Logo variant="sidebar" compact />
	</div>

	<nav class="shell-sidebar-nav">
		{#each mainNav as item (item.href + item.labelKey)}
			{@const showLiveDot = Boolean(item.liveDot && hasActiveSession)}
			<a
				class="sidebar-link"
				data-active={isActive(item.href)}
				href={item.href}
				aria-current={isActive(item.href) ? 'page' : undefined}
				aria-label={showLiveDot
					? `${translate(lang, item.labelKey)}. ${translate(lang, 'nav.liveActive')}`
					: undefined}
			>
				<span class="sidebar-link-icon" class:is-active={isActive(item.href)}>
					<LucideIcon icon={item.icon} size={ICON_SIDEBAR} />
				</span>
				<span>{translate(lang, item.labelKey)}</span>
			</a>
		{/each}
		{#if showDraftNav}
			<a
				class="sidebar-link sidebar-link--draft"
				data-active={draftActive}
				href="/builder"
				aria-current={draftActive ? 'page' : undefined}
			>
				<span class="sidebar-link-icon" class:is-active={draftActive}>
					<LucideIcon icon={ClipboardList} size={ICON_SIDEBAR} />
				</span>
				<span class="sidebar-link-draft-label">
					{translate(lang, 'draft.dockNav', { n: draftCount })}
				</span>
			</a>
		{/if}
	</nav>

	<div class="shell-sidebar-footer">
		<button
			type="button"
			class="sidebar-link"
			onclick={() => appTheme.toggle()}
			title={translate(lang, isLight ? 'settings.themeDark' : 'settings.themeLight')}
			aria-label={translate(lang, isLight ? 'settings.themeDark' : 'settings.themeLight')}
		>
			<span class="sidebar-link-icon" aria-hidden="true">
				<ThemeToggleIcon isLight={isLight} size={ICON_SIDEBAR} strokeWidth={1.75} />
			</span>
			<span>{translate(lang, isLight ? 'settings.themeDark' : 'settings.themeLight')}</span>
		</button>
		<a
			class="sidebar-link"
			data-active={isActive('/auth')}
			href="/auth"
			aria-current={isActive('/auth') ? 'page' : undefined}
		>
			<span
				class="sidebar-link-icon"
				class:sidebar-link-icon--avatar={profileSignedIn}
				class:is-active={isActive('/auth')}
			>
				{#if showProfilePhoto && profileAvatar}
					<img
						class="sidebar-avatar is-photo"
						src={profileAvatar}
						alt=""
						width="24"
						height="24"
						referrerpolicy="no-referrer"
						decoding="async"
						aria-hidden="true"
						onerror={() => {
							profileAvatarBroken = true;
						}}
					/>
				{:else if profileSignedIn && profileInitials}
					<span class="sidebar-avatar" aria-hidden="true">{profileInitials}</span>
				{:else}
					<LucideIcon icon={UserRound} size={ICON_SIDEBAR} />
				{/if}
			</span>
			<span>{translate(lang, 'nav.profile')}</span>
		</a>
	</div>
</aside>
