<script lang="ts">
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
		<label class="field-label" for="auth-theme">
			{translate(lang, 'settings.theme')}
			<select
				id="auth-theme"
				class="field mt-1 w-full"
				value={$appTheme}
				onchange={(e) => {
					appTheme.set((e.currentTarget as HTMLSelectElement).value as AppTheme);
				}}
			>
				<option value="dark">{translate(lang, 'settings.themeDark')}</option>
				<option value="light">{translate(lang, 'settings.themeLight')}</option>
			</select>
		</label>
	</div>
	<p class="mt-2 text-xs text-[var(--color-muted)]">{translate(lang, 'settings.themeHint')}</p>
</div>
