<script lang="ts">
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { passwordPolicyChecklist, PASSWORD_MIN_LENGTH } from '$lib/domain/passwordPolicy';
	import { translate } from '$lib/i18n/messages';
	import { resolvedLocale } from '$lib/stores/locale';
	import { Check, Circle } from '@lucide/svelte';

	let {
		password = '',
		email = ''
	}: {
		password?: string;
		email?: string;
	} = $props();

	let lang = $derived($resolvedLocale);
	let checks = $derived(passwordPolicyChecklist(password, email));
	let visible = $derived(password.length > 0);
	let allMet = $derived(
		checks.minLength && checks.hasLetter && checks.hasDigit && checks.notEmail
	);

	const rows = $derived([
		{ key: 'min', met: checks.minLength, label: translate(lang, 'auth.passwordRuleMin', { n: PASSWORD_MIN_LENGTH }) },
		{ key: 'letter', met: checks.hasLetter, label: translate(lang, 'auth.passwordRuleLetter') },
		{ key: 'digit', met: checks.hasDigit, label: translate(lang, 'auth.passwordRuleDigit') },
		{ key: 'email', met: checks.notEmail, label: translate(lang, 'auth.passwordRuleEmail') }
	]);
</script>

{#if visible}
	<ul
		class="password-policy-hints"
		class:is-complete={allMet}
		aria-label={translate(lang, 'auth.passwordRulesAria')}
		aria-live="polite"
	>
		{#each rows as row (row.key)}
			<li class:is-met={row.met}>
				<span class="password-policy-hints__mark" aria-hidden="true">
					{#if row.met}
						<LucideIcon icon={Check} size={14} strokeWidth={2.5} />
					{:else}
						<LucideIcon icon={Circle} size={14} strokeWidth={2} />
					{/if}
				</span>
				<span class="password-policy-hints__label">{row.label}</span>
			</li>
		{/each}
	</ul>
{/if}
