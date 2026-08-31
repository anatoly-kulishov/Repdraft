<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Sparkles, X } from '@lucide/svelte';

	let {
		message,
		onDismiss,
		class: className = ''
	}: {
		message: string;
		onDismiss: () => void;
		class?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
</script>

<div class="onboarding-coachmark panel {className}" role="note">
	<div class="onboarding-coachmark__body">
		<span class="onboarding-coachmark__icon" aria-hidden="true">
			<LucideIcon icon={Sparkles} size={ICON_SMALL} />
		</span>
		<p class="onboarding-coachmark__text">{message}</p>
	</div>
	<AppButton
		variant="ghost"
		class="onboarding-coachmark__dismiss"
		onclick={onDismiss}
		aria-label={translate(lang, 'a11y.close')}
	>
		<LucideIcon icon={X} size={ICON_SMALL} />
	</AppButton>
</div>
