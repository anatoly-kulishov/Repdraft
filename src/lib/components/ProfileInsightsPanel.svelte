<script lang="ts">
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import ProfileSettingsSection from '$lib/components/profile/ProfileSettingsSection.svelte';
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
			(acc, session) =>
				session.finishedAt && (!acc || session.finishedAt > acc) ? session.finishedAt : acc,
			null
		);
		coachBadge = coachBadgeVisible(latest, readCoachSeenAt());
	});
</script>

<ProfileSettingsSection>
	<ProfileSettingsRow icon={ChartBar} label={translate(lang, 'nav.progress')} href="/progress" />
	<ProfileSettingsRow
		icon={Robot}
		label={translate(lang, 'nav.coach')}
		href="/coach"
		badge={coachBadge}
		ariaLabel={coachBadge
			? `${translate(lang, 'nav.coach')}. ${translate(lang, 'coach.newHints')}`
			: undefined}
	/>
</ProfileSettingsSection>
