<script lang="ts">
	import { page } from '$app/stores';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_PRIMARY } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { House, Library } from '@lucide/svelte';

	let lang = $derived($resolvedLocale);
	let status = $derived($page.status);
	let is404 = $derived(status === 404);
	let detail = $derived($page.error?.message?.trim() || '');
</script>

<svelte:head>
	<title>
		{is404 ? translate(lang, 'error.404.title') : translate(lang, 'error.generic.title')} · Repdraft
	</title>
</svelte:head>

<section class="error-page content-page" aria-labelledby="error-heading">
	<div class="error-hero panel">
		<p class="error-kicker" aria-hidden="true">
			{#if is404}
				{translate(lang, 'error.404.kicker')}
			{:else}
				{translate(lang, 'error.generic.kicker')}
			{/if}
		</p>

		<div class="error-score" aria-hidden="true">
			<span class="error-score__code">{status}</span>
			<span class="error-score__sep">×</span>
			<span class="error-score__reps">0</span>
		</div>

		<div class="error-progress" aria-hidden="true">
			<div class="error-progress__track">
				<div class="error-progress__fill"></div>
			</div>
			<span class="error-progress__label">{translate(lang, 'error.progress')}</span>
		</div>

		<h1 id="error-heading" class="error-title">
			{#if is404}
				{translate(lang, 'error.404.title')}
			{:else}
				{translate(lang, 'error.generic.title')}
			{/if}
		</h1>
		<p class="error-lead">
			{#if is404}
				{translate(lang, 'error.404.lead')}
			{:else}
				{translate(lang, 'error.generic.lead')}
			{/if}
		</p>
		{#if !is404 && detail && detail !== 'Not Found'}
			<p class="error-detail">{detail}</p>
		{/if}

		<div class="error-actions">
			<a class="btn-primary inline-flex items-center gap-2 px-5" href="/">
				<LucideIcon icon={House} size={ICON_PRIMARY} />
				{translate(lang, 'error.home')}
			</a>
			{#if is404}
				<a class="btn-secondary inline-flex items-center gap-2 px-5" href="/exercises">
					<LucideIcon icon={Library} size={ICON_PRIMARY} />
					{translate(lang, 'error.catalog')}
				</a>
			{/if}
		</div>
	</div>
</section>
