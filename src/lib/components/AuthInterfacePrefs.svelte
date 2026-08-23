<script lang="ts">
	import AppLabel from '$lib/components/AppLabel.svelte';
	import AppSelect from '$lib/components/AppSelect.svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import { translate } from '$lib/i18n/messages';
	import type { AppTheme } from '$lib/domain/theme';
	import { appTheme } from '$lib/stores/theme';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
</script>

<div class="auth-account__section">
	<p class="auth-prefs__title">{translate(lang, 'settings.interfaceTitle')}</p>
	<div class="auth-prefs__stack">
		<LanguageSwitcher />
		<AppLabel for="auth-theme">
			{translate(lang, 'settings.theme')}
			<AppSelect
				id="auth-theme"
				class="mt-1 w-full"
				value={$appTheme}
				onchange={(e) => {
					appTheme.set((e.currentTarget as HTMLSelectElement).value as AppTheme);
				}}
			>
				<option value="dark">{translate(lang, 'settings.themeDark')}</option>
				<option value="light">{translate(lang, 'settings.themeLight')}</option>
			</AppSelect>
		</AppLabel>
	</div>
	<p class="mt-2 text-xs text-[var(--color-muted)]">{translate(lang, 'settings.themeHint')}</p>
</div>
