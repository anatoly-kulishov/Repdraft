<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import Spinner from '$lib/components/Spinner.svelte';
	import { WORKOUTS_HREF } from '$lib/domain/catalogLinks';
	import { translate } from '$lib/i18n/messages';
	import { draft } from '$lib/stores/draft';
	import { plans } from '$lib/stores/plans';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);

	$effect(() => {
		if (!browser) return;
		const id = $page.params.planId;
		if (!id) {
			void goto(WORKOUTS_HREF, { replaceState: true });
			return;
		}

		let cancelled = false;
		void plans.getPlan(id).then((plan) => {
			if (cancelled) return;
			if (!plan) {
				void goto(WORKOUTS_HREF, { replaceState: true });
				return;
			}
			draft.loadPlanIntoDraft(plan);
			void goto('/builder', { replaceState: true });
		});

		return () => {
			cancelled = true;
		};
	});
</script>

<Spinner label={translate(lang, 'builder.opening')} />
