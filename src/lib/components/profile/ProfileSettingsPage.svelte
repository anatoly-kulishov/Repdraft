<script lang="ts">
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import type { Snippet } from 'svelte';

	let {
		title,
		titleId = 'profile-settings-title',
		children
	}: {
		title: string;
		titleId?: string;
		children?: Snippet;
	} = $props();

	let lang = $derived($resolvedLocale);
</script>

<SeoHead {title} noindex />

<section class="auth-page content-page auth-page--account">
	<ScreenHeader
		fixed
		{title}
		{titleId}
		backHref="/auth"
		backLabel={translate(lang, 'settings.backProfile')}
		backLabelVisible
	/>
	<div class="profile-settings-stack profile-settings-stack--subpage">
		{@render children?.()}
	</div>
</section>
