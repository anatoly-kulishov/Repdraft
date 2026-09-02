<script lang="ts">
	let { variant = 'hint' }: { variant: 'hint' | 'coachmark' } = $props();
</script>

{#if variant === 'hint'}
	<p class="builder-group-hint builder-group-hint--skeleton" aria-hidden="true">
		<span class="builder-group-hint-skeleton__line"></span>
	</p>
{:else}
	<div class="onboarding-coachmark panel builder-coachmark-skeleton" aria-hidden="true">
		<div class="onboarding-coachmark__body">
			<span class="builder-coachmark-skeleton__icon" aria-hidden="true"></span>
			<div class="builder-coachmark-skeleton__lines" aria-hidden="true">
				<span class="builder-coachmark-skeleton__line"></span>
				<span class="builder-coachmark-skeleton__line builder-coachmark-skeleton__line--short"></span>
			</div>
		</div>
		<span class="builder-coachmark-skeleton__dismiss" aria-hidden="true"></span>
	</div>
{/if}
