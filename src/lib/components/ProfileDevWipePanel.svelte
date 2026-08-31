<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { Eraser } from '@lucide/svelte';

	let loading = $state(false);
	let confirmOpen = $state(false);

	let lang = $derived($resolvedLocale);

	function dismissConfirm() {
		if (loading) return;
		confirmOpen = false;
	}

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
</div>

<BottomSheet
	bind:open={confirmOpen}
	titleId="dev-wipe-confirm-title"
	dismissible={!loading}
	onDismiss={dismissConfirm}
>
	<p id="dev-wipe-confirm-title" class="bottom-sheet__title">
		{translate(lang, 'settings.devWipeConfirmTitle')}
	</p>
	<p class="bottom-sheet__hint">{translate(lang, 'settings.devWipeConfirmHint')}</p>
	{#snippet actions()}
		<AppButton variant="secondary" disabled={loading} onclick={dismissConfirm}>
			{translate(lang, 'settings.devWipeCancel')}
		</AppButton>
		<AppButton variant="danger" disabled={loading} aria-busy={loading} onclick={() => void wipeAll()}>
			{#if loading}
				<span class="inline-flex items-center gap-2">
					<Spinner size="sm" block={false} />
					{translate(lang, 'auth.wait')}
				</span>
			{:else}
				{translate(lang, 'settings.devWipeButton')}
			{/if}
		</AppButton>
	{/snippet}
</BottomSheet>
