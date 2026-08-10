<script lang="ts">
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SubrouteBack from '$lib/components/SubrouteBack.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
</script>

<svelte:head>
	<title>{translate(lang, 'settings.title')} — Repdraft</title>
</svelte:head>

<section class="content-page content-page--narrow">
	<div class="md:hidden">
		<ScreenHeader title={translate(lang, 'settings.title')} backHref="/" />
	</div>
	<div class="page-header">
		<div class="subroute-desktop-head hidden md:block">
			<SubrouteBack href="/" label={translate(lang, 'nav.tabHome')} />
		</div>
		<h1 class="page-title hidden md:block">{translate(lang, 'settings.title')}</h1>
		<p class="page-lead">{translate(lang, 'settings.lead')}</p>
	</div>

	<div class="panel">
		<LanguageSwitcher />
		<p class="mt-2 text-xs text-[var(--color-muted)]">{translate(lang, 'lang.hint')}</p>
	</div>
</section>
