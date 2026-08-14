<script lang="ts">
	import Spinner from '$lib/components/Spinner.svelte';
	import type { TechniqueClip } from '$lib/domain/clips';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';

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
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="clip-lightbox fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 pb-[calc(var(--safe-bottom)+1rem)] backdrop-blur-[2px]"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	aria-label={title}
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
>
	<div class="clip-lightbox__panel panel w-[min(100%,24rem)] max-h-[90vh] overflow-auto !rounded-2xl !p-0 shadow-xl">
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
			<div class="grid grid-cols-2 gap-2">
				<button type="button" class="btn-primary text-sm" onclick={onShare}>
					{canShareNative ? translate(lang, 'clips.share') : translate(lang, 'clips.link')}
				</button>
				<button type="button" class="btn-secondary text-sm" onclick={onClose}>
					{translate(lang, 'clips.close')}
				</button>
				{#if currentUserId && currentUserId === clip.userId}
					<button type="button" class="btn-secondary col-span-2 text-sm" onclick={onRename}>
						{translate(lang, 'clips.rename')}
					</button>
				{:else if currentUserId}
					<button
						type="button"
						class="btn-secondary col-span-2 text-sm text-[var(--color-muted)]"
						onclick={onReport}
					>
						{translate(lang, 'clips.report')}
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
