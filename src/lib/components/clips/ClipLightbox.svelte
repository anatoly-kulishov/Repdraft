<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import CloseIconButton from '$lib/components/CloseIconButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import { overlayPortal } from '$lib/actions/overlayPortal';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import type { TechniqueClip } from '$lib/domain/clips';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { Flag, Link2, Pencil, Share2 } from '@lucide/svelte';

	let {
		clip,
		lang,
		currentUserId,
		canShareNative,
		title,
		ready = $bindable(false),
		failed = $bindable(false),
		onClose,
		onShare,
		onRename,
		onReport
	}: {
		clip: TechniqueClip;
		lang: AppLocale;
		currentUserId: string | null;
		canShareNative: boolean;
		title: string;
		ready?: boolean;
		failed?: boolean;
		onClose: () => void;
		onShare: () => void;
		onRename: () => void;
		onReport: () => void;
	} = $props();

	let imgEl = $state<HTMLImageElement | null>(null);
	let shareLabel = $derived(
		canShareNative ? translate(lang, 'clips.share') : translate(lang, 'clips.link')
	);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	use:overlayPortal
	class="clip-lightbox"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	aria-label={title}
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
>
	<div class="clip-lightbox__panel panel relative w-[min(100%,24rem)] max-h-[90vh] overflow-auto !rounded-2xl !p-0">
		<CloseIconButton class="clip-lightbox__close" onclick={onClose} />
		<div class="relative aspect-square w-full overflow-hidden bg-[var(--color-surface-muted)]">
			{#if !ready && !failed}
				<div class="feed-skel absolute inset-0" aria-hidden="true"></div>
				<div class="absolute inset-0 z-[1] flex items-center justify-center">
					<Spinner size="sm" />
				</div>
			{/if}
			{#if failed}
				<p
					class="absolute inset-0 z-[1] flex items-center justify-center px-4 text-center text-sm text-[var(--color-muted)]"
				>
					{translate(lang, 'clips.mediaFail')}
				</p>
			{:else}
				<img
					bind:this={imgEl}
					src={clip.gifUrl}
					alt={title}
					width="480"
					height="480"
					class={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${ready ? 'opacity-100' : 'opacity-0'}`}
					decoding="async"
					fetchpriority="high"
					onload={() => {
						ready = true;
						failed = false;
					}}
					onerror={() => {
						ready = false;
						failed = true;
					}}
				/>
			{/if}
		</div>
		<div class="space-y-3 p-4">
			<div>
				<p class="font-semibold">{title}</p>
				<p class="text-xs text-[var(--color-muted)]">
					{clip.authorLabel} · {clip.createdAt.slice(0, 10)}
				</p>
			</div>
			<div class="clip-lightbox__actions">
				<AppButton
					variant="ghost"
					class="clip-lightbox__action"
					onclick={onShare}
					aria-label={shareLabel}
					title={shareLabel}
				>
					<LucideIcon icon={canShareNative ? Share2 : Link2} size={ICON_BUTTON} />
				</AppButton>
				{#if currentUserId && currentUserId === clip.userId}
					<AppButton
						variant="ghost"
						class="clip-lightbox__action"
						onclick={onRename}
						aria-label={translate(lang, 'clips.rename')}
						title={translate(lang, 'clips.rename')}
					>
						<LucideIcon icon={Pencil} size={ICON_BUTTON} />
					</AppButton>
				{:else if currentUserId}
					<AppButton
						variant="ghost"
						class="clip-lightbox__action"
						onclick={onReport}
						aria-label={translate(lang, 'clips.report')}
						title={translate(lang, 'clips.report')}
					>
						<LucideIcon icon={Flag} size={ICON_BUTTON} />
					</AppButton>
				{/if}
			</div>
		</div>
	</div>
</div>
