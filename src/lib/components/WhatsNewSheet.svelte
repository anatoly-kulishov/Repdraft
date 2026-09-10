<script lang="ts">
	import { APP_VERSION_LABEL } from '$lib/appVersion';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { localizedChangelog } from '$lib/domain/changelog';
	import { TESTER_MODE_UNLOCK_TAPS } from '$lib/domain/prefs';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { testerModeEnabled } from '$lib/stores/prefs';
	import { toasts } from '$lib/stores/toasts';
	import { cn } from '$lib/utils.js';
	import { get } from 'svelte/store';

	let {
		class: className = 'auth-account__version'
	}: {
		class?: string;
	} = $props();

	let open = $state(false);
	let lang = $derived($resolvedLocale);
	let releases = $derived(localizedChangelog(lang, 5));
	let unlockTaps = $state(0);
	let unlockResetTimer: ReturnType<typeof setTimeout> | null = null;

	function clearUnlockTimer() {
		if (unlockResetTimer) {
			clearTimeout(unlockResetTimer);
			unlockResetTimer = null;
		}
	}

	function openSheet() {
		open = true;
	}

	function dismiss() {
		open = false;
		unlockTaps = 0;
		clearUnlockTimer();
	}

	function onUnlockVersionTap() {
		if (get(testerModeEnabled)) return;
		clearUnlockTimer();
		unlockTaps += 1;
		if (unlockTaps >= TESTER_MODE_UNLOCK_TAPS) {
			unlockTaps = 0;
			testerModeEnabled.set(true);
			toasts.show(translate(lang, 'settings.testerModeOn'), 'info', 3200);
			return;
		}
		unlockResetTimer = setTimeout(() => {
			unlockTaps = 0;
			unlockResetTimer = null;
		}, 1600);
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
	<button
		type="button"
		class="whats-new-unlock-version"
		aria-label={APP_VERSION_LABEL}
		onclick={onUnlockVersionTap}
	>
		{APP_VERSION_LABEL}
	</button>
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
