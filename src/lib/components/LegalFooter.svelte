<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { enPath } from '$lib/seo/alternates';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
	/** Only tools/programs have `/en/*` mirrors; legal pages are ru-only. */
	let toolsHref = $derived(lang === 'en' ? enPath('/tools') : '/tools');
	let programsHref = $derived(lang === 'en' ? enPath('/programs') : '/programs');
</script>

<nav class="legal-footer" aria-label={translate(lang, 'legal.footerAria')}>
	<a class="legal-footer__link" href={toolsHref}>{translate(lang, 'tools.title')}</a>
	<span class="legal-footer__sep" aria-hidden="true">·</span>
	<a class="legal-footer__link" href={programsHref}>{translate(lang, 'programs.title')}</a>
	<span class="legal-footer__sep" aria-hidden="true">·</span>
	<a class="legal-footer__link" href="/articles">{translate(lang, 'articles.title')}</a>
	<span class="legal-footer__sep" aria-hidden="true">·</span>
	<a class="legal-footer__link" href="/terms">{translate(lang, 'legal.footerTerms')}</a>
	<span class="legal-footer__sep" aria-hidden="true">·</span>
	<a class="legal-footer__link" href="/privacy">{translate(lang, 'legal.footerPrivacy')}</a>
	<span class="legal-footer__sep" aria-hidden="true">·</span>
	<a class="legal-footer__link" href="/feedback">{translate(lang, 'legal.footerFeedback')}</a>
	<span class="legal-footer__sep" aria-hidden="true">·</span>
	<a class="legal-footer__link" href="/legal/requisites">
		{translate(lang, 'legal.footerRequisites')}
	</a>
</nav>

<style>
	.legal-footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.2rem 0.5rem;
		padding: 0.45rem 0.75rem;
		font-size: 0.6875rem;
		line-height: 1.35;
		color: var(--color-muted);
	}

	@media (min-width: 768px) {
		.legal-footer {
			font-size: 0.75rem;
		}
	}

	/* Muted one-liner: links stay readable but stop looking like a site footer. */
	.legal-footer__link {
		color: inherit;
		text-decoration: none;
		border-radius: 4px;
	}

	.legal-footer__link:hover {
		color: var(--color-ink);
	}

	.legal-footer__link:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	.legal-footer__sep {
		opacity: 0.5;
	}
</style>
