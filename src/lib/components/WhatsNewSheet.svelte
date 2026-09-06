<script lang="ts">
	import { APP_VERSION_LABEL } from '$lib/appVersion';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { localizedChangelog } from '$lib/domain/changelog';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { cn } from '$lib/utils.js';

	let {
		class: className = 'auth-account__version'
	}: {
		class?: string;
	} = $props();

	let open = $state(false);
	let lang = $derived($resolvedLocale);
	let releases = $derived(localizedChangelog(lang, 5));

	function openSheet() {
		open = true;
	}

	function dismiss() {
		open = false;
	}
</script>

<button
	type="button"
	class={cn(className, 'whats-new-version-btn')}
	aria-label={translate(lang, 'changelog.openAria', { version: APP_VERSION_LABEL })}
	aria-haspopup="dialog"
	aria-expanded={open}
	onclick={openSheet}
>
	{APP_VERSION_LABEL}
</button>

<BottomSheet
	bind:open
	titleId="whats-new-sheet-title"
	raised
	onDismiss={dismiss}
>
	<p id="whats-new-sheet-title" class="bottom-sheet__title">
		{translate(lang, 'changelog.title')}
	</p>
	<p class="bottom-sheet__hint">{translate(lang, 'changelog.lead')}</p>
	<ul class="whats-new-list">
		{#each releases as release (release.version)}
			<li class="whats-new-release">
				<p class="whats-new-release__version">{release.label}</p>
				<ul class="whats-new-release__items">
					{#each release.highlights as item, i (`${release.version}-${i}`)}
						<li>{item}</li>
					{/each}
				</ul>
			</li>
		{/each}
	</ul>
</BottomSheet>
