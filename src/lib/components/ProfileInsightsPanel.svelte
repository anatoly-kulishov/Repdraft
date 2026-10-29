<script lang="ts">
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import { coachBadgeVisible } from '$lib/domain/coachHints';
	import { translate } from '$lib/i18n/messages';
	import { peekLocalFinishedSessions } from '$lib/storage/localSessionRepository';
	import { readCoachSeenAt } from '$lib/stores/coachHints';
	import { resolvedLocale } from '$lib/stores/locale';
	import { onMount } from 'svelte';
	import { ChartBar, Robot } from 'phosphor-svelte';

	let lang = $derived($resolvedLocale);
	let coachBadge = $state(false);

	onMount(() => {
		const latest = peekLocalFinishedSessions().reduce<string | null>(
			(acc, session) => (session.finishedAt && (!acc || session.finishedAt > acc) ? session.finishedAt : acc),
			null
		);
		coachBadge = coachBadgeVisible(latest, readCoachSeenAt());
	});
</script>

<div class="profile-settings-group panel">
	<p class="profile-settings-group__title">{translate(lang, 'progress.sectionTitle')}</p>
	<ProfileSettingsRow
		icon={ChartBar}
		label={translate(lang, 'nav.progress')}
		href="/progress"
	/>
	<ProfileSettingsRow icon={Robot} label={translate(lang, 'nav.coach')} href="/coach">
		{#if coachBadge}
			<span class="coach-badge" aria-hidden="true"></span>
			<span class="sr-only">{translate(lang, 'coach.newHints')}</span>
		{/if}
	</ProfileSettingsRow>
</div>

<style>
	.coach-badge {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 999px;
		background: var(--color-accent);
	}
</style>
