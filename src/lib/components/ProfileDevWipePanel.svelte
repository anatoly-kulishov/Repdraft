<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { Eraser } from '@lucide/svelte';

	let loading = $state(false);
	let confirmOpen = $state(false);

	let lang = $derived($resolvedLocale);

	async function wipeAll() {
		if (loading) return;
		loading = true;
		try {
			await auth.wipeLocalProfileForTesting();
			window.location.assign('/');
		} catch (err) {
			console.error('dev wipe failed', err);
			toasts.show(translate(lang, 'settings.devWipeFail'), 'error');
			loading = false;
		}
	}
</script>

<div class="profile-dev-wipe panel">
	<div class="profile-dev-wipe__head">
		<span class="profile-dev-wipe__icon" aria-hidden="true">
			<LucideIcon icon={Eraser} size={ICON_SMALL} />
		</span>
		<div class="profile-dev-wipe__copy min-w-0">
			<p class="profile-settings-group__title profile-dev-wipe__title">
				{translate(lang, 'settings.devWipeTitle')}
			</p>
			<p class="profile-settings-group__hint profile-dev-wipe__lead">
				{translate(lang, 'settings.devWipeLead')}
			</p>
		</div>
	</div>

	{#if !confirmOpen}
		<AppButton
			variant="danger"
			block
			class="profile-dev-wipe__trigger"
			disabled={loading}
			onclick={() => {
				confirmOpen = true;
			}}
		>
			{translate(lang, 'settings.devWipeButton')}
		</AppButton>
	{:else}
		<div class="profile-dev-wipe__confirm" role="group" aria-label={translate(lang, 'settings.devWipeConfirm')}>
			<p class="profile-dev-wipe__confirm-text">{translate(lang, 'settings.devWipeConfirm')}</p>
			<div class="profile-dev-wipe__confirm-actions">
				<AppButton
					variant="secondary"
					disabled={loading}
					onclick={() => {
						confirmOpen = false;
					}}
				>
					{translate(lang, 'settings.devWipeCancel')}
				</AppButton>
				<AppButton variant="danger" disabled={loading} onclick={() => void wipeAll()}>
					{translate(lang, 'settings.devWipeButton')}
				</AppButton>
			</div>
		</div>
	{/if}
</div>
