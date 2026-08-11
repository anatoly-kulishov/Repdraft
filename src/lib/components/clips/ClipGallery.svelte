<script lang="ts">
	import type { TechniqueClip } from '$lib/domain/clips';
	import type { AppLocale } from '$lib/i18n/locale';
	import { translate } from '$lib/i18n/messages';

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

<ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
	{#each clips as clip (clip.id)}
		<li
			data-clip-id={clip.id}
			class="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)] transition-[box-shadow,border-color]"
			class:border-[var(--color-accent)]={highlightId === clip.id}
			class:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_28%,transparent)]={highlightId ===
				clip.id}
			class:border-[var(--color-border)]={highlightId !== clip.id}
		>
			<button
				type="button"
				class="relative block w-full cursor-zoom-in overflow-hidden bg-[var(--color-surface-muted)] p-0"
				onclick={() => onOpen(clip)}
				aria-label={translate(lang, 'clips.open', { title: titleFor(clip) })}
			>
				<div class="relative aspect-square w-full">
					{#if !thumbReady.has(clip.id)}
						<div class="feed-skel absolute inset-0" aria-hidden="true"></div>
					{/if}
					<img
						src={clip.gifUrl}
						alt={titleFor(clip)}
						width="360"
						height="360"
						class={`absolute inset-0 m-auto max-h-full max-w-full object-contain transition-opacity duration-200 ${thumbReady.has(clip.id) ? 'opacity-100' : 'opacity-0'}`}
						loading="lazy"
						decoding="async"
						onload={() => onThumbReady(clip.id)}
						onerror={() => onThumbReady(clip.id)}
					/>
				</div>
			</button>
			<div class="space-y-2 p-3">
				<div>
					<p class="font-semibold leading-snug">{titleFor(clip)}</p>
					<p class="text-xs text-[var(--color-muted)]">
						{clip.authorLabel} · {clip.createdAt.slice(0, 10)}
					</p>
				</div>
				<div class="grid grid-cols-2 gap-2">
					<button type="button" class="btn-secondary text-sm" onclick={() => onShare(clip)}>
						{canShareNative ? translate(lang, 'clips.share') : translate(lang, 'clips.link')}
					</button>
					<button type="button" class="btn-secondary text-sm" onclick={() => onCopyGif(clip)}>
						{translate(lang, 'clips.copyGif')}
					</button>
					{#if currentUserId === clip.userId}
						<button type="button" class="btn-secondary text-sm" onclick={() => onRename(clip)}>
							{translate(lang, 'clips.rename')}
						</button>
						<button type="button" class="btn-danger text-sm" onclick={() => onRemove(clip)}>
							{translate(lang, 'clips.delete')}
						</button>
					{:else if currentUserId}
						<button
							type="button"
							class="btn-secondary col-span-2 text-sm text-[var(--color-muted)]"
							onclick={() => onReport(clip)}
						>
							{translate(lang, 'clips.report')}
						</button>
					{/if}
				</div>
			</div>
		</li>
	{/each}
</ul>
