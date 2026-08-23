<script lang="ts">
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_BUTTON } from '$lib/components/icons/sizes';
	import type { TechniqueClip } from '$lib/domain/clips';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';
	import { Copy, Flag, Link2, Pencil, Share2, Trash2 } from '@lucide/svelte';

	let {
		clips,
		lang,
		highlightId,
		currentUserId,
		canShareNative,
		thumbReady,
		titleFor,
		onOpen,
		onThumbReady,
		onShare,
		onCopyGif,
		onRename,
		onRemove,
		onReport
	}: {
		clips: TechniqueClip[];
		lang: AppLocale;
		highlightId: string | null;
		currentUserId: string | null;
		canShareNative: boolean;
		thumbReady: Set<string>;
		titleFor: (clip: TechniqueClip) => string;
		onOpen: (clip: TechniqueClip) => void;
		onThumbReady: (id: string) => void;
		onShare: (clip: TechniqueClip) => void;
		onCopyGif: (clip: TechniqueClip) => void;
		onRename: (clip: TechniqueClip) => void;
		onRemove: (clip: TechniqueClip) => void;
		onReport: (clip: TechniqueClip) => void;
	} = $props();
</script>

<ul class="clip-gallery grid grid-cols-1 gap-3">
	{#each clips as clip (clip.id)}
		<li
			data-clip-id={clip.id}
			class="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)] transition-[box-shadow,border-color]"
			class:border-[var(--color-accent)]={highlightId === clip.id}
			class:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_28%,transparent)]={highlightId ===
				clip.id}
			class:border-[var(--color-border)]={highlightId !== clip.id}
		>
			<AppButton
				variant="ghost"
				class="relative block w-full cursor-zoom-in overflow-hidden bg-[var(--color-surface-muted)] !h-auto !min-h-0 !min-w-0 p-0"
				onclick={() => onOpen(clip)}
				aria-label={translate(lang, 'clips.open', { title: titleFor(clip) })}
			>
				<div class="clip-gallery__thumb relative aspect-square w-full lg:aspect-[4/3]">
					{#if !thumbReady.has(clip.id)}
						<div class="feed-skel absolute inset-0" aria-hidden="true"></div>
					{/if}
					<img
						src={clip.gifUrl}
						alt={titleFor(clip)}
						width="360"
						height="360"
						class={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${thumbReady.has(clip.id) ? 'opacity-100' : 'opacity-0'}`}
						loading="lazy"
						decoding="async"
						onload={() => onThumbReady(clip.id)}
						onerror={() => onThumbReady(clip.id)}
					/>
				</div>
			</AppButton>
			<div class="space-y-2 p-3">
				<div>
					<p class="font-semibold leading-snug">{titleFor(clip)}</p>
					<p class="text-xs text-[var(--color-muted)]">
						{clip.authorLabel} · {clip.createdAt.slice(0, 10)}
					</p>
				</div>
				<div class="clip-card-actions">
					<AppButton
						variant="ghost"
						class="clip-card-action"
						onclick={() => onShare(clip)}
						aria-label={canShareNative ? translate(lang, 'clips.share') : translate(lang, 'clips.link')}
						title={canShareNative ? translate(lang, 'clips.share') : translate(lang, 'clips.link')}
					>
						<LucideIcon icon={canShareNative ? Share2 : Link2} size={ICON_BUTTON} />
					</AppButton>
					<AppButton
						variant="ghost"
						class="clip-card-action"
						onclick={() => onCopyGif(clip)}
						aria-label={translate(lang, 'clips.copyGif')}
						title={translate(lang, 'clips.copyGif')}
					>
						<LucideIcon icon={Copy} size={ICON_BUTTON} />
					</AppButton>
					{#if currentUserId === clip.userId}
						<AppButton
							variant="ghost"
							class="clip-card-action"
							onclick={() => onRename(clip)}
							aria-label={translate(lang, 'clips.rename')}
							title={translate(lang, 'clips.rename')}
						>
							<LucideIcon icon={Pencil} size={ICON_BUTTON} />
						</AppButton>
						<AppButton
							variant="ghost"
							class="is-danger clip-card-action"
							onclick={() => onRemove(clip)}
							aria-label={translate(lang, 'clips.delete')}
							title={translate(lang, 'clips.delete')}
						>
							<LucideIcon icon={Trash2} size={ICON_BUTTON} />
						</AppButton>
					{:else if currentUserId}
						<AppButton
							variant="ghost"
							class="clip-card-action"
							onclick={() => onReport(clip)}
							aria-label={translate(lang, 'clips.report')}
							title={translate(lang, 'clips.report')}
						>
							<LucideIcon icon={Flag} size={ICON_BUTTON} />
						</AppButton>
					{/if}
				</div>
			</div>
		</li>
	{/each}
</ul>

<style>
	.clip-card-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.clip-card-action {
		min-width: 2.5rem;
		min-height: 2.5rem;
		padding: 0.4rem;
	}
</style>
