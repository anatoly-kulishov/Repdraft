<script lang="ts">
	import { GYM_VISUAL_ATTRIBUTION, GYM_VISUAL_URL } from '$lib/data/attribution';
</script>

<footer
	class="mt-auto border-t border-[var(--color-border)] px-4 py-4 text-center text-xs text-[var(--color-muted)] md:px-6"
>
	Медиа упражнений
	<a class="underline decoration-[var(--color-accent)] underline-offset-2 hover:text-[var(--color-ink)]" href={GYM_VISUAL_URL} target="_blank" rel="noreferrer">
		{GYM_VISUAL_ATTRIBUTION}
	</a>
</footer>
