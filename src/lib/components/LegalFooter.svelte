<script lang="ts">
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
</script>

<nav class="legal-footer" aria-label={translate(lang, 'legal.footerAria')}>
	<a class="legal-footer__link" href="/terms">{translate(lang, 'legal.footerTerms')}</a>
	<span class="legal-footer__sep" aria-hidden="true">·</span>
	<a class="legal-footer__link" href="/privacy">{translate(lang, 'legal.footerPrivacy')}</a>
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
		gap: 0.35rem;
		padding: 0.65rem 0.75rem;
		font-size: 11px;
		line-height: 1.35;
		color: var(--color-muted);
	}

	@media (min-width: 768px) {
		.legal-footer {
			font-size: 0.75rem;
		}
	}

	.legal-footer__link {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--color-border) 90%, transparent);
		text-underline-offset: 2px;
	}

	.legal-footer__link:hover {
		color: var(--color-ink);
	}

	.legal-footer__sep {
		opacity: 0.6;
	}
</style>
