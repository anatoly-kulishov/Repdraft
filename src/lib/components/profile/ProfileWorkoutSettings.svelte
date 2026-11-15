<script lang="ts">
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import ProfileSettingsSection from '$lib/components/profile/ProfileSettingsSection.svelte';
	import { isIosDevice } from '$lib/domain/pwaInstall';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { restHapticEnabled, restSoundEnabled } from '$lib/stores/prefs';
	import { DeviceMobile, Timer } from 'phosphor-svelte';

	let lang = $derived($resolvedLocale);
	let restSoundHintKey = $derived.by(() => {
		if (typeof navigator === 'undefined' || typeof window === 'undefined') {
			return 'settings.restSoundHint';
		}
		return isIosDevice({
			ua: navigator.userAgent,
			platform: navigator.platform,
			maxTouchPoints: navigator.maxTouchPoints,
			coarsePointer: window.matchMedia('(pointer: coarse)').matches
		})
			? 'settings.restSoundHintIos'
			: 'settings.restSoundHint';
	});
</script>

<ProfileSettingsSection hint={translate(lang, restSoundHintKey)}>
	<ProfileSettingsRow icon={Timer} label={translate(lang, 'settings.restSound')} chevron={false}>
		<input
			type="checkbox"
			class="auth-pref-toggle__input profile-settings-row__toggle"
			checked={$restSoundEnabled}
			aria-label={translate(lang, 'settings.restSound')}
			onchange={(e) => {
				restSoundEnabled.set((e.currentTarget as HTMLInputElement).checked);
			}}
		/>
	</ProfileSettingsRow>
	<ProfileSettingsRow
		icon={DeviceMobile}
		label={translate(lang, 'profile.hapticRest')}
		chevron={false}
	>
		<input
			type="checkbox"
			class="auth-pref-toggle__input profile-settings-row__toggle"
			checked={$restHapticEnabled}
			aria-label={translate(lang, 'profile.hapticRest')}
			onchange={(e) => {
				restHapticEnabled.set((e.currentTarget as HTMLInputElement).checked);
			}}
		/>
	</ProfileSettingsRow>
</ProfileSettingsSection>
