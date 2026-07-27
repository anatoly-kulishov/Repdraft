<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { draft } from '$lib/stores/draft';
	import { plans } from '$lib/stores/plans';

	$effect(() => {
		if (!browser) return;
		const id = $page.params.planId;
		if (!id) {
			goto('/workouts');
			return;
		}

		let cancelled = false;
		void plans.getPlan(id).then((plan) => {
			if (cancelled) return;
			if (!plan) {
				goto('/workouts');
				return;
			}
			draft.loadPlanIntoDraft(plan);
			goto('/builder');
		});

		return () => {
			cancelled = true;
		};
	});
</script>

<p class="text-sm text-[var(--color-muted)]">Открываем план…</p>
