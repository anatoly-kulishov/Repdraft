<script lang="ts">
	import { browser } from '$app/environment';
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import RecognizeProgramSheet from '$lib/components/program/RecognizeProgramSheet.svelte';
	import { proFromAppMetadata } from '$lib/domain/entitlement';
	import { translate } from '$lib/i18n/messages';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';
	import { getSupabase } from '$lib/supabase/client';
	import { Camera } from 'phosphor-svelte';
	import { onMount } from 'svelte';

	let {
		variant = 'ghost',
		block = false,
		class: className = ''
	}: {
		variant?: 'primary' | 'action' | 'secondary' | 'danger' | 'ghost' | 'link';
		block?: boolean;
		class?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
	let open = $state(false);
	let remotePro = $state<boolean | null>(null);
	let metaPro = $derived(
		proFromAppMetadata($auth.user?.app_metadata as Record<string, unknown> | undefined).pro
	);
	let isPro = $derived(remotePro ?? metaPro);

	onMount(() => {
		if (!browser || !$auth.user) return;
		void (async () => {
			const supabase = getSupabase();
			if (!supabase) return;
			try {
				await supabase.auth.refreshSession();
			} catch {
				/* ignore */
			}
			const {
				data: { session }
			} = await supabase.auth.getSession();
			const token = session?.access_token;
			if (!token) return;
			const res = await fetch('/api/billing/status', {
				headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
			});
			if (!res.ok) return;
			const body = (await res.json()) as { pro?: boolean };
			if (typeof body.pro === 'boolean') remotePro = body.pro;
		})();
	});
</script>

{#if isPro}
	<AppButton
		{variant}
		{block}
		class={className}
		onclick={() => {
			open = true;
		}}
	>
		<LucideIcon icon={Camera} size={ICON_SMALL} />
		{translate(lang, 'recognize.cta')}
	</AppButton>

	<RecognizeProgramSheet bind:open />
{/if}
