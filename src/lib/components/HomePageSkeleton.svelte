<script lang="ts">
	import AppSkeleton from '$lib/components/AppSkeleton.svelte';
	import BrandTagline from '$lib/components/BrandTagline.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY, ICON_SMALL } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { LogIn, NotebookPen, Plus, Smartphone, UserRound } from '@lucide/svelte';

	let {
		label,
		variant = 'start'
	}: {
		label: string;
		/** create = guest empty hero; start = mockup CTA + plans | recent */
		variant?: 'create' | 'start';
	} = $props();

	let lang = $derived($resolvedLocale);

	const guestHeroPoints = [
		{ icon: NotebookPen, key: 'home.guestPointLog' as const },
		{ icon: Smartphone, key: 'home.guestPointLocal' as const },
		{ icon: UserRound, key: 'home.guestPointSync' as const }
	];
</script>

<div
	class="home-dashboard home-skeleton"
	class:home-skeleton--create={variant === 'create'}
	class:home-skeleton--start={variant === 'start'}
	aria-busy="true"
	aria-live="polite"
>
	<span class="sr-only">{label}</span>

	{#if variant === 'create'}
		<div class="home-dashboard-top" aria-hidden="true">
			<!-- Real guest copy sizes the bones → same box as live (no CLS). -->
			<div class="home-hero home-hero--guest home-skeleton-create-hero">
				<p class="home-hero-kicker home-skel-bone">
					{translate(lang, 'home.guestTrainKicker')}
				</p>
				<h2 class="home-hero-title home-skel-bone">
					{translate(lang, 'home.guestTrainTitle')}
				</h2>
				<p class="home-hero-meta home-skel-bone">
					{translate(lang, 'home.guestTrainLead')}
				</p>
				<ul class="home-hero-points">
					{#each guestHeroPoints as point (point.key)}
						<li class="home-hero-point">
							<span class="home-hero-point__icon home-skel-bone home-skel-bone--icon">
								<LucideIcon icon={point.icon} size={ICON_SMALL} />
							</span>
							<span class="home-hero-point__text home-skel-bone">
								{translate(lang, point.key)}
							</span>
						</li>
					{/each}
				</ul>
				<BrandTagline class="brand-tagline--hero home-skel-bone" />
				<div class="home-hero-actions">
					<span class="home-hero-cta home-skel-bone home-skel-bone--cta">
						<LucideIcon icon={Plus} size={ICON_PRIMARY} />
						{translate(lang, 'home.guestCreateLocal')}
					</span>
					<span class="home-hero-secondary home-skel-bone home-skel-bone--cta">
						<LucideIcon icon={LogIn} size={ICON_PRIMARY} />
						{translate(lang, 'nav.signIn')}
					</span>
				</div>
			</div>
		</div>
	{:else}
		<header class="home-header home-header--mockup home-skeleton-mockup" aria-hidden="true">
			<div class="home-header__row">
				<div class="home-header__copy">
					<AppSkeleton class="home-skeleton-mockup-title" />
					<AppSkeleton class="home-skeleton-mockup-meta" />
					<AppSkeleton class="home-skeleton-mockup-meta home-skeleton-mockup-meta--short" />
				</div>
				<AppSkeleton class="home-skeleton-mockup-cta" />
			</div>
		</header>
	{/if}
</div>
