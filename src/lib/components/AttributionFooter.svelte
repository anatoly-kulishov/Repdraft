<script lang="ts">
	import { GYM_VISUAL_ATTRIBUTION, GYM_VISUAL_URL } from '$lib/data/attribution';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
</script>

<footer
	class="shell-footer mt-auto border-t border-[var(--color-border)] py-3 text-[11px] leading-snug text-[var(--color-muted)] md:py-4 md:text-xs"
>
	<p class="shell-footer-inner">
		{translate(lang, 'attr.media')}
		<a
			class="underline decoration-[var(--color-accent)] underline-offset-2 hover:text-[var(--color-ink)]"
			href={GYM_VISUAL_URL}
			target="_blank"
			rel="noreferrer"
		>
			{GYM_VISUAL_ATTRIBUTION}
		</a>
	</p>
</footer>
