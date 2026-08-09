<script lang="ts">
	import { GYM_VISUAL_ATTRIBUTION, GYM_VISUAL_URL } from '$lib/data/attribution';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
</script>

<footer
	class="mt-auto border-t border-[var(--color-border)] px-4 py-3 text-center text-[11px] leading-snug text-[var(--color-muted)] md:px-6 md:py-4 md:text-xs"
>
	{translate(lang, 'attr.media')}
	<a
		class="underline decoration-[var(--color-accent)] underline-offset-2 hover:text-[var(--color-ink)]"
		href={GYM_VISUAL_URL}
		target="_blank"
		rel="noreferrer"
	>
		{GYM_VISUAL_ATTRIBUTION}
	</a>
</footer>
