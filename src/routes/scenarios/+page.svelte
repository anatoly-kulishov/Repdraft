<script lang="ts">
	import { replaceState } from '$app/navigation';
	import AppButton from '$lib/components/AppButton.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import { renderDocMarkdownDocument } from '$lib/domain/docMarkdown';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import { translate } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Download } from '@lucide/svelte';
	import '$lib/styles/blocks/scenarios.css';

	let { data } = $props();
	let lang = $derived($resolvedLocale);
	let title = $derived(translate(lang, 'scenarios.title'));
	let doc = $derived(renderDocMarkdownDocument(data.bodyMd));
	let bodyHtml = $derived(doc.html);
	let tocSections = $derived(doc.headings.filter((h) => h.level === 2));

	function downloadMarkdown() {
		const blob = new Blob([data.bodyMd], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'repdraft-user-scenarios.md';
		anchor.click();
		URL.revokeObjectURL(url);
	}

	/** Hash via SK replaceState so TOC does not stack history entries. */
	function jumpToSection(event: MouseEvent, id: string) {
		event.preventDefault();
		const target = document.getElementById(id);
		if (!target) return;
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		target.scrollIntoView({
			behavior: reduceMotion ? 'auto' : 'smooth',
			block: 'start'
		});
		replaceState(`#${id}`, {});
	}
</script>

<SeoHead {title} noindex />

<div class="content-page content-page--catalog scenarios-page">
	<ScreenHeader {title} backHref="/auth" />

	<p class="scenarios-page__lead">{translate(lang, 'scenarios.lead')}</p>

	<div
		class="scenarios-page__layout"
		class:scenarios-page__layout--with-toc={tocSections.length > 0}
	>
		{#if tocSections.length > 0}
			<details class="scenarios-page__toc panel" open>
				<summary class="scenarios-page__toc-summary">
					{translate(lang, 'scenarios.toc')}
				</summary>
				<nav class="scenarios-page__toc-nav" aria-label={translate(lang, 'scenarios.toc')}>
					<p class="scenarios-page__toc-heading">{translate(lang, 'scenarios.toc')}</p>
					<ol class="scenarios-page__toc-list">
						{#each tocSections as heading (heading.id)}
							<li class="scenarios-page__toc-item">
								<a
									class="scenarios-page__toc-link"
									href={`#${heading.id}`}
									onclick={(e) => jumpToSection(e, heading.id)}
								>
									{heading.title}
								</a>
							</li>
						{/each}
					</ol>
				</nav>
			</details>
		{/if}

		<article class="scenarios-page__body panel prose-article prose-doc scenarios-doc">
			{@html bodyHtml}
		</article>

		<div class="scenarios-page__footer">
			<AppButton
				variant="secondary"
				class="scenarios-page__download"
				aria-label={translate(lang, 'scenarios.downloadAria')}
				onclick={downloadMarkdown}
			>
				<span class="inline-flex items-center gap-1.5">
					<LucideIcon icon={Download} size={ICON_SMALL} />
					{translate(lang, 'scenarios.download')}
				</span>
			</AppButton>
		</div>
	</div>
</div>
