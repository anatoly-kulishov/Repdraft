<script lang="ts">
	import { page } from '$app/stores';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppChip from '$lib/components/AppChip.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppLabel from '$lib/components/AppLabel.svelte';
	import AppTextarea from '$lib/components/AppTextarea.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import {
		FEEDBACK_HONEYPOT_FIELD,
		FEEDBACK_KINDS,
		FEEDBACK_MESSAGE_MAX,
		feedbackKindLabelKey,
		validateFeedback,
		type FeedbackFieldError,
		type FeedbackKind
	} from '$lib/domain/feedback';
	import { translate } from '$lib/i18n/messages';
	import { PRIVACY_CONTACT_EMAIL } from '$lib/legal/privacyOperator';
	import { auth } from '$lib/stores/auth';
	import { resolvedLocale } from '$lib/stores/locale';

	let lang = $derived($resolvedLocale);
	let title = $derived(translate(lang, 'feedback.title'));

	let kind = $state<FeedbackKind>('bug');
	let message = $state('');
	let email = $state('');
	let honeypot = $state('');
	let sending = $state(false);
	let sent = $state(false);
	let errorText = $state<string | null>(null);
	let fieldError = $state<FeedbackFieldError | null>(null);
	let emailTouched = $state(false);

	let signedInEmail = $derived($auth.user?.email ?? '');
	let appVersion = import.meta.env.PUBLIC_APP_VERSION as string | undefined;
	let fallbackEmail = $derived(PRIVACY_CONTACT_EMAIL);

	// Signed-in users do not retype their address; a typed one always wins.
	$effect(() => {
		if (!emailTouched && !email && signedInEmail) email = signedInEmail;
	});

	function resetErrors() {
		errorText = null;
		fieldError = null;
	}

	/**
	 * Same-origin referrer beats `/feedback`: a bug is usually reported right after
	 * the broken screen, and that path is the most useful line in the e-mail.
	 */
	function sourcePage(): string {
		const here = $page.url.pathname;
		if (typeof document === 'undefined') return here;
		try {
			const ref = new URL(document.referrer);
			if (ref.origin === window.location.origin && ref.pathname !== here) return ref.pathname;
		} catch {
			/* Direct visit: no referrer. */
		}
		return here;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (sending) return;
		resetErrors();

		const validated = validateFeedback({
			kind,
			message,
			email,
			page: sourcePage(),
			lang
		});
		if (!validated.ok) {
			fieldError = validated.field;
			errorText = translate(lang, validated.errorKey);
			return;
		}

		sending = true;
		try {
			const response = await fetch('/api/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...validated.value,
					appVersion,
					[FEEDBACK_HONEYPOT_FIELD]: honeypot
				})
			});
			const data = (await response.json().catch(() => null)) as
				| { ok?: boolean; error?: string; field?: string; email?: string; minutes?: number }
				| null;

			if (!response.ok || !data?.ok) {
				if (response.status === 429) {
					errorText = translate(lang, 'feedback.rateLimited', {
						minutes: Math.max(1, Number(data?.minutes) || 1)
					});
				} else if (response.status === 503) {
					errorText = translate(lang, 'feedback.unavailable', {
						email: data?.email || fallbackEmail
					});
				} else {
					errorText = translate(lang, data?.error ?? 'feedback.sendFail');
				}
				if (data?.field === 'message' || data?.field === 'email') fieldError = data.field;
				return;
			}

			sent = true;
			message = '';
			email = '';
			honeypot = '';
		} catch {
			errorText = translate(lang, 'feedback.sendFail');
		} finally {
			sending = false;
		}
	}

	function sendAnother() {
		sent = false;
		kind = 'bug';
		emailTouched = false;
		resetErrors();
	}
</script>

<SeoHead
	titleKey="feedback.title"
	descriptionKey="seo.feedbackDescription"
	path="/feedback"
/>

<div class="content-page content-page--narrow privacy-page feedback-page">
	<ScreenHeader {title} backHref="/" />

	<p class="privacy-page__lead">{translate(lang, 'feedback.lead')}</p>

	{#if sent}
		<div class="panel feedback-sent" role="status" aria-live="polite">
			<p class="feedback-sent__title">{translate(lang, 'feedback.sentTitle')}</p>
			<p class="feedback-sent__lead">{translate(lang, 'feedback.sentLead')}</p>
			<AppButton variant="secondary" onclick={sendAnother}>
				{translate(lang, 'feedback.sentAgain')}
			</AppButton>
		</div>
	{:else}
		<form class="panel feedback-form" onsubmit={submit} novalidate>
			<fieldset class="feedback-field feedback-field--kinds">
				<legend class="field-label">{translate(lang, 'feedback.kindLabel')}</legend>
				<div class="feedback-kinds" role="group" aria-label={translate(lang, 'feedback.kindLabel')}>
					{#each FEEDBACK_KINDS as id (id)}
						<AppChip
							active={kind === id}
							aria-pressed={kind === id}
							onclick={() => {
								kind = id;
								resetErrors();
							}}
						>
							{translate(lang, feedbackKindLabelKey(id))}
						</AppChip>
					{/each}
				</div>
			</fieldset>

			<div class="feedback-field">
				<AppLabel for="feedback-message">{translate(lang, 'feedback.messageLabel')}</AppLabel>
				<AppTextarea
					id="feedback-message"
					name="message"
					class="min-h-[9.5rem] resize-y leading-relaxed"
					rows={6}
					maxlength={FEEDBACK_MESSAGE_MAX}
					required
					bind:value={message}
					placeholder={translate(lang, 'feedback.messagePlaceholder')}
					aria-invalid={fieldError === 'message' ? 'true' : undefined}
					aria-describedby="feedback-message-hint"
					oninput={() => {
						if (fieldError === 'message') resetErrors();
					}}
				/>
				<p id="feedback-message-hint" class="feedback-hint">
					{translate(lang, 'feedback.messageHint', {
						n: message.length,
						max: FEEDBACK_MESSAGE_MAX
					})}
				</p>
			</div>

			<div class="feedback-field">
				<AppLabel for="feedback-email">
					{translate(lang, 'feedback.emailLabel')}
				</AppLabel>
				<AppInput
					id="feedback-email"
					name="email"
					type="email"
					inputmode="email"
					autocomplete="email"
					spellcheck="false"
					bind:value={email}
					placeholder={translate(lang, 'feedback.emailPlaceholder')}
					aria-invalid={fieldError === 'email' ? 'true' : undefined}
					aria-describedby="feedback-email-hint"
					oninput={() => {
						emailTouched = true;
						if (fieldError === 'email') resetErrors();
					}}
				/>
				<p id="feedback-email-hint" class="feedback-hint">
					{translate(lang, 'feedback.emailHint')}
				</p>
			</div>

			<div class="feedback-honeypot" aria-hidden="true">
				<label for="feedback-website">Website</label>
				<input
					id="feedback-website"
					name={FEEDBACK_HONEYPOT_FIELD}
					type="text"
					tabindex="-1"
					autocomplete="off"
					bind:value={honeypot}
				/>
			</div>

			{#if errorText}
				<p class="feedback-error" role="alert">{errorText}</p>
			{/if}

			<AppButton type="submit" block disabled={sending} aria-busy={sending}>
				{sending ? translate(lang, 'feedback.sending') : translate(lang, 'feedback.submit')}
			</AppButton>

			<p class="feedback-consent">
				{translate(lang, 'feedback.consentLead')}
				<a class="feedback-consent__link" href="/privacy">
					{translate(lang, 'feedback.consentLink')}
				</a>
			</p>
		</form>
	{/if}

	<p class="feedback-fallback">
		{translate(lang, 'feedback.fallbackLead')}
		<a class="feedback-fallback__link" href={`mailto:${fallbackEmail}`}>{fallbackEmail}</a>
	</p>
</div>

<style>
	.feedback-form {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 1.1rem 1.05rem 1.25rem;
	}

	.feedback-field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	.feedback-field--kinds {
		gap: 0.5rem;
	}

	.feedback-kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.feedback-hint {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.4;
		color: var(--color-muted);
	}

	/* Off-screen, not `display:none`: bots fill inputs that exist in the layout. */
	.feedback-honeypot {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	.feedback-error {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.45;
		color: var(--color-danger, #c0392b);
	}

	.feedback-consent {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.45;
		color: var(--color-muted);
		text-align: center;
	}

	.feedback-consent__link,
	.feedback-fallback__link {
		color: var(--color-accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.feedback-sent {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		align-items: flex-start;
		padding: 1.1rem 1.05rem 1.25rem;
	}

	.feedback-sent__title {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.feedback-sent__lead {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--color-muted);
	}

	.feedback-fallback {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.45;
		color: var(--color-muted);
		text-align: center;
		overflow-wrap: anywhere;
	}
</style>
