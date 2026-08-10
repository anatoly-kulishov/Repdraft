<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SIDEBAR } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { draft, draftHydrated } from '$lib/stores/draft';
	import { appTheme } from '$lib/stores/theme';
	import { resolvedLocale } from '$lib/stores/locale';
	import { ClipboardList, Dumbbell, House, Library, Moon, Settings, Sun, UserRound } from '@lucide/svelte';

	let {
		path,
		isActive
	}: {
		path: string;
		isActive: (href: string) => boolean;
	} = $props();

	let lang = $derived($resolvedLocale);
	let isLight = $derived($appTheme === 'light');
	let draftCount = $derived($draft.exercises.length);
	let showDraftNav = $derived($draftHydrated && draftCount > 0);
	let draftActive = $derived(path.startsWith('/builder'));

	type NavItem = {
		href: string;
		labelKey: string;
		icon: typeof House;
	};

	const mainNav: NavItem[] = [
		{ href: '/', labelKey: 'nav.tabHome', icon: House },
		{ href: '/workouts', labelKey: 'nav.workouts', icon: Dumbbell },
		{ href: '/exercises', labelKey: 'nav.exercises', icon: Library }
	];
</script>

<aside class="shell-sidebar" aria-label={translate(lang, 'nav.main')}>
	<div class="shell-sidebar-brand">
		<Logo variant="sidebar" />
	</div>

	<nav class="shell-sidebar-nav">
		{#each mainNav as item (item.href + item.labelKey)}
			<a
				class="sidebar-link"
				data-active={isActive(item.href)}
				href={item.href}
				aria-current={isActive(item.href) ? 'page' : undefined}
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
				<span>{translate(lang, 'draft.dock', { n: draftCount })}</span>
			</a>
		{/if}
	</nav>

	<div class="shell-sidebar-footer">
		<button
			type="button"
			class="sidebar-link w-full"
			onclick={() => appTheme.toggle()}
			title={translate(lang, isLight ? 'settings.themeDark' : 'settings.themeLight')}
			aria-label={translate(lang, isLight ? 'settings.themeDark' : 'settings.themeLight')}
		>
			<span class="sidebar-link-icon" aria-hidden="true">
				{#if isLight}
					<Moon size={ICON_SIDEBAR} strokeWidth={1.75} />
				{:else}
					<Sun size={ICON_SIDEBAR} strokeWidth={1.75} />
				{/if}
			</span>
			<span>{translate(lang, isLight ? 'settings.themeDark' : 'settings.themeLight')}</span>
		</button>
		<a
			class="sidebar-link"
			data-active={isActive('/settings')}
			href="/settings"
			aria-current={isActive('/settings') ? 'page' : undefined}
		>
			<span class="sidebar-link-icon" class:is-active={isActive('/settings')}>
				<LucideIcon icon={Settings} size={ICON_SIDEBAR} />
			</span>
			<span>{translate(lang, 'nav.settings')}</span>
		</a>
		<a
			class="sidebar-link"
			data-active={isActive('/auth')}
			href="/auth"
			aria-current={isActive('/auth') ? 'page' : undefined}
		>
			<span class="sidebar-link-icon" class:is-active={isActive('/auth')}>
				<LucideIcon icon={UserRound} size={ICON_SIDEBAR} />
			</span>
			<span>{translate(lang, 'nav.profile')}</span>
		</a>
	</div>
</aside>
