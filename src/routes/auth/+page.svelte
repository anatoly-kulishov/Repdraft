<script lang="ts">
	import { browser } from '$app/environment';
	import { createDelayedTrue } from '$lib/browser/delayedTrue.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		authErrorMessageKey,
		isAuthEmailCallback,
		passwordsMatch,
		safeRedirectPath,
		userAuthProvider,
		userCustomAvatarPath,
		userDisplayName,
		userInitials
	} from '$lib/domain/authFlow';
	import { isTurnstileConfigured } from '$lib/auth/publicAuthConfig';
	import { assertStrongPassword } from '$lib/security/assertStrongPassword';
	import { formatRelativeDay } from '$lib/i18n/format';
	import { translate, translateError } from '$lib/i18n/messages';
	import SeoHead from '$lib/seo/SeoHead.svelte';
	import { auth } from '$lib/stores/auth';
	import { greetingName } from '$lib/stores/greetingName';
	import { resolvedLocale } from '$lib/stores/locale';
	import { toasts } from '$lib/stores/toasts';
	import { homeNextPlan } from '$lib/stores/homeNextPlan';
	import { plans } from '$lib/stores/plans';
	import { resolveUserAvatarUrl } from '$lib/storage/avatarsRepository';
	import AppButton from '$lib/components/AppButton.svelte';
	import AppInput from '$lib/components/AppInput.svelte';
	import AppLabel from '$lib/components/AppLabel.svelte';
	import AuthInterfacePrefs from '$lib/components/AuthInterfacePrefs.svelte';
	import IconPlate from '$lib/components/IconPlate.svelte';
	import ProfileInsightsPanel from '$lib/components/ProfileInsightsPanel.svelte';
	import {
		INVITE_CODE_LENGTH,
		isValidInviteCode,
		normalizeInviteCode,
		type CoachAssignment,
		type CoachMyCoach
	} from '$lib/domain/coach';
	import { isSupabaseConfigured } from '$lib/supabase/client';
	import { coachRepository } from '$lib/storage/coachRepository';
	import AuthLegalConsent from '$lib/components/AuthLegalConsent.svelte';
	import BrandTagline from '$lib/components/BrandTagline.svelte';
	import PageSkeleton from '$lib/components/PageSkeleton.svelte';
	import PasswordField from '$lib/components/PasswordField.svelte';
	import PasswordPolicyHints from '$lib/components/PasswordPolicyHints.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import ConfirmSheet from '$lib/components/ConfirmSheet.svelte';
	import AvatarCropSheet from '$lib/components/AvatarCropSheet.svelte';
	import ProfileAvatarSheet from '$lib/components/ProfileAvatarSheet.svelte';
	import ProfileSettingsRow from '$lib/components/ProfileSettingsRow.svelte';
	import ScreenHeader from '$lib/components/ScreenHeader.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import TurnstileWidget from '$lib/components/TurnstileWidget.svelte';
	import DataExportSection from '$lib/components/DataExportSection.svelte';
	import LoopMetricsPanel from '$lib/components/LoopMetricsPanel.svelte';
	import ProfileDevWipePanel from '$lib/components/ProfileDevWipePanel.svelte';
	import OnboardingChecklist from '$lib/components/onboarding/OnboardingChecklist.svelte';
	import WhatsNewSheet from '$lib/components/WhatsNewSheet.svelte';
	import LucideIcon from '$lib/components/icons/LucideIcon.svelte';
	import { ICON_SMALL } from '$lib/components/icons/sizes';
	import {
		GREETING_NAME_MAX,
		clampGreetingName,
		greetingNameMatchesStored
	} from '$lib/domain/greetingName';
	import { checklistProgress } from '$lib/domain/onboarding';
	import { isIosDevice } from '$lib/domain/pwaInstall';
	import { onboarding } from '$lib/stores/onboarding';
	import {
		restHapticEnabled,
		restSoundEnabled,
		testerModeEnabled
	} from '$lib/stores/prefs';
	import { testerToolsVisible } from '$lib/domain/prefs';
	import {
		Camera,
		CaretDown as ChevronDown,
		ClipboardText,
		DeviceMobile,
		FileText,
		Info,
		ShieldCheck,
		SignOut,
		Timer,
		User as UserRound,
		UserCheck,
		UsersThree
	} from 'phosphor-svelte';
	import { tick } from 'svelte';

	let { data } = $props();

	type Panel = 'signin' | 'signup' | 'magic' | 'forgot' | 'check-email';
	let legalAccepted = $state(false);

	let panel = $state<Panel>('signin');
	let email = $state('');
	let password = $state('');
	let passwordConfirm = $state('');
	let loading = $state(false);
	/** Account mutations: keep labels, show spinner on the active control. */
	let accountBusy = $state<'logout' | 'logoutEverywhere' | 'delete' | null>(null);
	let accountLocked = $derived(accountBusy !== null);
	let message = $state<string | null>(null);
	let checkEmailKind = $state<'signup' | 'magic' | 'reset'>('signup');
	let redirected = $state(false);
	let greetingNameInput = $state('');
	let greetingNameSaving = $state(false);
	/** Only enable the Save button after the user actually edits the field. Prevents
	 *  a violet flash while the store hydrates and the input is still being seeded. */
	let greetingNameTouched = $state(false);
	let fieldsInvalid = $state(false);
	let confirmMismatchVisible = $state(false);
	let deleteZoneOpen = $state(false);
	let deleteConfirmOpen = $state(false);
	let deleteConfirmText = $state('');
	let coachInviteInput = $state('');
	let coachInviteBusy = $state(false);
	let coachInviteError = $state<string | null>(null);
	let coachInviteHasChars = $derived(normalizeInviteCode(coachInviteInput).length > 0);
	let coachSheetOpen = $state(false);

	let coachCloud = $derived(isSupabaseConfigured() && Boolean($auth.user));
	let ownUserId = $derived($auth.user?.id ?? null);
	let myCoaches = $state<CoachMyCoach[]>([]);
	/** User id whose links are already in state, so switching accounts refetches. */
	let clientCoachLoadedFor = $state<string | null>(null);
	let clientCoachLoading = $state(false);
	let clientCoachLoaded = $derived(Boolean(ownUserId) && clientCoachLoadedFor === ownUserId);
	let disconnectTarget = $state<CoachMyCoach | null>(null);
	let disconnectBusy = $state(false);

	let currentAssignment = $state<CoachAssignment | null>(null);
	let assignmentLoadedFor = $state<string | null>(null);
	let assignmentBusy = $state(false);

	async function loadClientCoachLinks() {
		const userId = ownUserId;
		if (!coachCloud || !userId || clientCoachLoading) return;
		clientCoachLoading = true;
		try {
			const result = await coachRepository.listMyCoaches();
			if (result.ok) myCoaches = result.value;
			clientCoachLoadedFor = userId;
		} finally {
			clientCoachLoading = false;
		}
	}

	async function loadCurrentAssignment() {
		const userId = ownUserId;
		if (!coachCloud || !userId || assignmentLoadedFor === userId) return;
		const result = await coachRepository.myCurrentAssignment();
		if (result.ok) currentAssignment = result.value;
		assignmentLoadedFor = userId;
	}

	async function importAssignment() {
		const assignment = currentAssignment;
		if (!assignment || assignmentBusy) return;
		assignmentBusy = true;
		try {
			const { plan } = await plans.importPlan({
				name: assignment.planName,
				exercises: assignment.exercises
			});
			homeNextPlan.pin(plan.id);
			const discard = await coachRepository.discardAssignment();
			currentAssignment = null;
			toasts.show(translate(lang, 'coach.assignedAdded'), 'success');
			if (!discard.ok) {
				toasts.show(translate(lang, `coach.error.${discard.reason}`), 'error');
			}
		} catch {
			toasts.show(translate(lang, 'coach.error.unknown'), 'error');
		} finally {
			assignmentBusy = false;
		}
	}

	async function dismissAssignment() {
		if (!currentAssignment || assignmentBusy) return;
		assignmentBusy = true;
		try {
			const result = await coachRepository.discardAssignment();
			if (result.ok) {
				currentAssignment = null;
				toasts.show(translate(lang, 'coach.assignedDismissed'), 'info');
			} else {
				toasts.show(translate(lang, `coach.error.${result.reason}`), 'error');
			}
		} finally {
			assignmentBusy = false;
		}
	}

	$effect(() => {
		if (!coachCloud || !ownUserId || clientCoachLoaded || clientCoachLoading) return;
		void loadClientCoachLinks();
	});

	$effect(() => {
		if (!coachCloud || !ownUserId) return;
		void loadCurrentAssignment();
	});

	function onCoachInviteInput(el: HTMLInputElement) {
		const cleaned = normalizeInviteCode(el.value).slice(0, INVITE_CODE_LENGTH);
		const next = cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned;
		coachInviteInput = next;
		coachInviteError = null;
		if (el.value !== next) el.value = next;
	}

	async function acceptCoachInvite() {
		if (coachInviteBusy) return;
		const code = normalizeInviteCode(coachInviteInput);
		if (!isValidInviteCode(code)) {
			coachInviteError = translate(lang, 'coach.inviteInvalid');
			return;
		}
		coachInviteError = null;
		coachInviteBusy = true;
		try {
			const result = await coachRepository.acceptInvite(code);
			if (result.ok) {
				coachInviteInput = '';
				coachSheetOpen = false;
				toasts.show(translate(lang, 'coach.inviteAccepted'), 'success');
				clientCoachLoadedFor = null;
				assignmentLoadedFor = null;
				void loadClientCoachLinks();
				void loadCurrentAssignment();
			} else {
				coachInviteError = translate(lang, `coach.error.${result.reason}`);
			}
		} finally {
			coachInviteBusy = false;
		}
	}

	function requestDisconnectCoach(coach: CoachMyCoach) {
		if (disconnectBusy) return;
		disconnectTarget = coach;
	}

	function dismissDisconnectCoach() {
		if (disconnectBusy) return;
		disconnectTarget = null;
	}

	function confirmDisconnectCoach() {
		const target = disconnectTarget;
		disconnectTarget = null;
		if (target) void disconnectCoach(target);
	}

	async function disconnectCoach(coach: CoachMyCoach) {
		disconnectBusy = true;
		try {
			const result = await coachRepository.revokeAsClient(coach.linkId);
			if (result.ok) {
				myCoaches = myCoaches.filter((row) => row.linkId !== coach.linkId);
				toasts.show(translate(lang, 'coach.disconnectDone'), 'success');
				assignmentLoadedFor = null;
				void loadCurrentAssignment();
			} else {
				toasts.show(translate(lang, `coach.error.${result.reason}`), 'error');
			}
		} finally {
			disconnectBusy = false;
		}
	}

	function coachDisplayName(coach: CoachMyCoach): string {
		return coach.coachName?.trim() || translate(lang, 'profile.coachFallback');
	}
	let logoutConfirmOpen = $state(false);
	let logoutEverywhereConfirmOpen = $state(false);
	let captchaToken = $state('');
	let captchaReset = $state(0);
	let avatarSheetOpen = $state(false);
	let avatarBusy = $state(false);
	let avatarFileInput: HTMLInputElement | null = $state(null);
	let avatarCropOpen = $state(false);
	let avatarCropFile = $state<File | null>(null);
	let avatarRemoveOpen = $state(false);

	let turnstileOn = $derived(isTurnstileConfigured());

	function requireLegalAccepted(): boolean {
		if (legalAccepted) return true;
		const text = translate(lang, 'auth.legalConsentNeed');
		message = text;
		toasts.show(text, 'error', 5000);
		void flashInvalid();
		return false;
	}
	function clearConfirmMismatch() {
		confirmMismatchVisible = false;
	}

	function onConfirmPasswordBlur() {
		// Defer so a following pointer click on submit still fires form submit.
		window.setTimeout(() => {
			confirmMismatchVisible =
				passwordConfirm.length > 0 && !passwordsMatch(password, passwordConfirm);
		}, 0);
	}

	function requireCaptchaToken(): string | undefined {
		if (!turnstileOn) return undefined;
		if (!captchaToken.trim()) {
			throw new Error('auth.errors.captchaRequired');
		}
		return captchaToken.trim();
	}

	function bumpCaptcha() {
		captchaToken = '';
		captchaReset += 1;
	}
	async function flashInvalid() {
		fieldsInvalid = false;
		await tick();
		fieldsInvalid = true;
	}

	let lang = $derived($resolvedLocale);
	let coachRowValue = $derived(
		!clientCoachLoaded
			? '…'
			: myCoaches.length === 0
				? translate(lang, 'profile.coachNone')
				: myCoaches.length === 1
					? translate(lang, 'profile.coachConnected')
					: translate(lang, 'profile.coachesConnected', { n: myCoaches.length })
	);
	let showTesterTools = $derived(
		testerToolsVisible({ pref: $testerModeEnabled, dev: import.meta.env.DEV })
	);
	let onboardingProgress = $derived(checklistProgress($onboarding));
	let onboardingComplete = $derived(
		onboardingProgress.total > 0 && onboardingProgress.done >= onboardingProgress.total
	);
	let confirmMismatchHint = $derived(
		confirmMismatchVisible ? translate(lang, 'auth.errors.passwordMismatch') : null
	);
	let restSoundHintKey = $derived(
		browser &&
			isIosDevice({
				ua: navigator.userAgent,
				platform: navigator.platform,
				maxTouchPoints: navigator.maxTouchPoints,
				coarsePointer: window.matchMedia('(pointer: coarse)').matches
			})
			? 'settings.restSoundHintIos'
			: 'settings.restSoundHint'
	);
	let deleteConfirmWord = $derived(translate(lang, 'auth.deleteConfirmWord'));
	let deleteConfirmReady = $derived(deleteConfirmText.trim() === deleteConfirmWord);
	let nextPath = $derived(safeRedirectPath($page.url.searchParams.get('next')));
	let recoveryMode = $derived($auth.passwordRecovery);
	let profileName = $derived(userDisplayName($auth.user));
	let profileEmail = $derived($auth.user?.email ?? '');
	let profileAvatar = $derived(resolveUserAvatarUrl($auth.user));
	let profileInitials = $derived(userInitials($auth.user));
	let profileAvatarBroken = $state(false);
	let showProfilePhoto = $derived(Boolean(profileAvatar) && !profileAvatarBroken);
	let hasCustomAvatar = $derived(Boolean(userCustomAvatarPath($auth.user)));
	let profileProvider = $derived(userAuthProvider($auth.user));
	let profileProviderLabel = $derived.by(() => {
		const id = profileProvider;
		if (!id) return null;
		if (id === 'email') return translate(lang, 'auth.provider.email');
		if (id === 'google') return translate(lang, 'auth.provider.oauth');
		const bare = id.replace(/^custom:/, '');
		return translate(lang, 'auth.provider.other', {
			name: bare.charAt(0).toUpperCase() + bare.slice(1)
		});
	});

	$effect(() => {
		profileAvatar;
		profileAvatarBroken = false;
	});

	/** Tap-to-copy on the profile hero (username / email). */
	async function copyProfileValue(value: string | null | undefined, kind: 'name' | 'email') {
		const text = value?.trim();
		if (!browser || !text) return;
		try {
			await navigator.clipboard.writeText(text);
			toasts.show(
				translate(lang, kind === 'email' ? 'profile.copyEmail' : 'profile.copyName'),
				'success'
			);
		} catch {
			toasts.show(translate(lang, 'profile.copyFail'), 'error');
		}
	}

	let backLabel = $derived(
		nextPath === '/' ? translate(lang, 'nav.tabHome') : translate(lang, 'a11y.back')
	);

	$effect(() => {
		if (!$auth.ready || !$auth.sessionKnown || !$auth.user || recoveryMode || redirected) return;
		const params = $page.url.searchParams;
		const hash = typeof window !== 'undefined' ? window.location.hash : '';
		if (!isAuthEmailCallback(params.toString(), hash)) return;
		redirected = true;
		const emailConfirmed =
			/type=signup/.test(hash) || params.get('type') === 'signup';
		toasts.show(
			translate(lang, emailConfirmed ? 'auth.emailConfirmedToast' : 'auth.signinToast'),
			'success'
		);
		void goto(nextPath, { replaceState: true });
	});

	function mapErr(err: unknown): string {
		const key = authErrorMessageKey(err);
		if (key) return translate(lang, key);
		const msg =
			err instanceof Error
				? err.message.trim()
				: err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
					? (err as { message: string }).message.trim()
					: '';
		if (msg.startsWith('auth.') || msg.startsWith('errors.')) {
			return translate(lang, msg);
		}
		return translateError(lang, err, 'auth.error');
	}

	/** Rate limit / soft errors: toast only. Field shake is for bad credentials, not “wait a minute”. */
	function reportAuthError(err: unknown) {
		const text = mapErr(err);
		const key = authErrorMessageKey(err);
		if (key === 'auth.errors.rateLimit') {
			message = null;
			fieldsInvalid = false;
			toasts.show(text, 'error');
			return;
		}
		message = text;
		toasts.show(text, 'error');
		void flashInvalid();
	}

	function openCheckEmail(kind: typeof checkEmailKind) {
		checkEmailKind = kind;
		panel = 'check-email';
		message = null;
		password = '';
		passwordConfirm = '';
		clearConfirmMismatch();
	}

	async function submitPassword() {
		if (!$auth.configured) {
			toasts.show(translate(lang, 'auth.notConfigured'), 'error');
			return;
		}
		loading = true;
		message = null;
		fieldsInvalid = false;
		try {
			const captcha = requireCaptchaToken();
			if (panel === 'signup') {
				if (!requireLegalAccepted()) return;
				if (!passwordsMatch(password, passwordConfirm)) {
					confirmMismatchVisible = true;
					const text = translate(lang, 'auth.errors.passwordMismatch');
					message = text;
					toasts.show(text, 'error', 5000);
					void flashInvalid();
					return;
				}
				clearConfirmMismatch();
				await assertStrongPassword(password, email.trim());
				const { session } = await auth.signUp(email.trim(), password, nextPath, captcha);
				bumpCaptcha();
				if (session) {
					toasts.show(translate(lang, 'auth.signinToast'), 'success');
					redirected = true;
					await goto(nextPath, { replaceState: true });
					return;
				}
				toasts.show(translate(lang, 'auth.signupToast'), 'success');
				openCheckEmail('signup');
			} else {
				await auth.signIn(email.trim(), password, captcha);
				bumpCaptcha();
				toasts.show(translate(lang, 'auth.signinToast'), 'success');
				redirected = true;
				await goto(nextPath, { replaceState: true });
			}
		} catch (err) {
			bumpCaptcha();
			reportAuthError(err);
		} finally {
			loading = false;
		}
	}

	async function submitMagic() {
		if (!$auth.configured) {
			toasts.show(translate(lang, 'auth.notConfigured'), 'error');
			return;
		}
		if (!requireLegalAccepted()) return;
		loading = true;
		message = null;
		fieldsInvalid = false;
		try {
			const captcha = requireCaptchaToken();
			await auth.signInWithOtp(email.trim(), nextPath, captcha);
			bumpCaptcha();
			toasts.show(translate(lang, 'auth.magicToast'), 'success');
			openCheckEmail('magic');
		} catch (err) {
			bumpCaptcha();
			reportAuthError(err);
		} finally {
			loading = false;
		}
	}

	async function submitForgot() {
		if (!$auth.configured) {
			toasts.show(translate(lang, 'auth.notConfigured'), 'error');
			return;
		}
		loading = true;
		message = null;
		fieldsInvalid = false;
		try {
			const captcha = requireCaptchaToken();
			await auth.resetPasswordForEmail(email.trim(), captcha, nextPath);
			bumpCaptcha();
			toasts.show(translate(lang, 'auth.resetToast'), 'success');
			openCheckEmail('reset');
		} catch (err) {
			bumpCaptcha();
			reportAuthError(err);
		} finally {
			loading = false;
		}
	}

	async function submitRecovery() {
		loading = true;
		message = null;
		fieldsInvalid = false;
		try {
			if (!passwordsMatch(password, passwordConfirm)) {
				confirmMismatchVisible = true;
				const text = translate(lang, 'auth.errors.passwordMismatch');
				message = text;
				toasts.show(text, 'error', 5000);
				void flashInvalid();
				return;
			}
			clearConfirmMismatch();
			await assertStrongPassword(password, $auth.user?.email ?? email.trim());
			await auth.updatePassword(password);
			toasts.show(translate(lang, 'auth.passwordUpdated'), 'success');
			password = '';
			passwordConfirm = '';
			clearConfirmMismatch();
			auth.clearPasswordRecovery();
			redirected = true;
			await goto(nextPath, { replaceState: true });
		} catch (err) {
			reportAuthError(err);
		} finally {
			loading = false;
		}
	}

	async function logout() {
		if (accountBusy) return;
		accountBusy = 'logout';
		try {
			await auth.signOut();
			toasts.show(translate(lang, 'auth.signedOut'), 'info');
		} catch (err) {
			toasts.show(mapErr(err) || translateError(lang, err, 'auth.signOutError'), 'error');
		} finally {
			accountBusy = null;
		}
	}

	function openLogoutConfirm() {
		if (accountBusy) return;
		logoutConfirmOpen = true;
	}

	function dismissLogoutConfirm() {
		logoutConfirmOpen = false;
	}

	function openLogoutEverywhereConfirm() {
		if (accountBusy) return;
		logoutEverywhereConfirmOpen = true;
	}

	function dismissLogoutEverywhereConfirm() {
		logoutEverywhereConfirmOpen = false;
	}

	async function logoutEverywhere() {
		if (accountBusy) return;
		logoutEverywhereConfirmOpen = false;
		accountBusy = 'logoutEverywhere';
		try {
			await auth.signOutEverywhere();
			toasts.show(translate(lang, 'auth.logoutEverywhereDone'), 'info');
		} catch (err) {
			toasts.show(mapErr(err) || translateError(lang, err, 'auth.signOutError'), 'error');
		} finally {
			accountBusy = null;
		}
	}

	function toggleDeleteZone() {
		deleteZoneOpen = !deleteZoneOpen;
		if (!deleteZoneOpen) cancelDeleteConfirm();
	}

	async function openDeleteConfirm() {
		deleteZoneOpen = true;
		deleteConfirmOpen = true;
		deleteConfirmText = '';
		await tick();
		document.getElementById('auth-delete-confirm')?.focus();
	}

	function cancelDeleteConfirm() {
		deleteConfirmOpen = false;
		deleteConfirmText = '';
	}

	async function deleteAccount() {
		if (accountBusy || !deleteConfirmReady) return;
		accountBusy = 'delete';
		try {
			await auth.deleteAccount();
			toasts.show(translate(lang, 'auth.deleteDone'), 'info');
			await goto('/', { replaceState: true });
		} catch (err) {
			toasts.show(mapErr(err) || translateError(lang, err, 'auth.deleteFail'), 'error');
		} finally {
			accountBusy = null;
		}
	}

	function setPanel(next: Panel) {
		panel = next;
		message = null;
		clearConfirmMismatch();
	}

	function openMagicLink() {
		setPanel('magic');
	}

	function setPasswordMode(mode: 'signin' | 'signup') {
		message = null;
		panel = mode;
		clearConfirmMismatch();
	}

	let passwordMode = $derived(
		panel === 'signup' ? ('signup' as const) : panel === 'forgot' ? ('forgot' as const) : ('signin' as const)
	);
	let accountMode = $derived($auth.ready && $auth.sessionKnown && Boolean($auth.user) && !recoveryMode);
	/**
	 * Boot skeleton: prefer account grid when a signed-in session is likely.
	 * SSR uses `repdraft_auth_boot` cookie (same peek as home). Client also reads
	 * `dataset.authBoot` from app.html for the first paint after login before the
	 * next full document request.
	 * Hold skeleton until sessionKnown so early `ready` does not flash guest UI.
	 */
	let bootLikelyAccount = $derived(
		data.bootPeek.accountBoot ||
			(browser && document.documentElement.dataset.authBoot === 'account')
	);
	/** Dev/QA: force boot skeleton via ?skeleton=account|guest */
	let skeletonForce = $derived(
		$page.url.searchParams.get('skeleton') === 'account'
			? ('account' as const)
			: $page.url.searchParams.get('skeleton') === 'guest'
				? ('guest' as const)
				: null
	);
	let authSessionPending = $derived(!browser || !$auth.sessionKnown);
	let showAccountSkeleton = $derived(
		skeletonForce === 'account' ||
			(authSessionPending && !skeletonForce && bootLikelyAccount)
	);
	let showGuestSkeleton = $derived(
		skeletonForce === 'guest' ||
			(authSessionPending && !skeletonForce && !bootLikelyAccount)
	);
	/** Natural boot loading (not ?skeleton= force). */
	let isBootLoading = $derived(authSessionPending && skeletonForce === null);
	let delayedBootSkeleton = createDelayedTrue(() => isBootLoading);
	// SSR: show skeleton immediately (no $effect delay). Client: delay to avoid FOLS.
	let showBootSkeleton = $derived(
		skeletonForce !== null || (!browser && isBootLoading) || delayedBootSkeleton.current
	);
	/** Real cloud-off UI only after client auth finished and keys are missing. */
	let showCloudOff = $derived(
		browser && $auth.ready && $auth.sessionKnown && !$auth.configured && !showBootSkeleton
	);
	let guestExtrasMode = $derived(
		$auth.ready && $auth.sessionKnown && !accountMode && !recoveryMode && !showBootSkeleton
	);

	$effect(() => {
		if (!accountMode) return;
		greetingNameInput = $greetingName;
	});

	let greetingNameDirty = $derived(
		greetingNameTouched && !greetingNameMatchesStored($greetingName, greetingNameInput)
	);

	async function saveGreetingName() {
		if (greetingNameSaving || !$auth.user || !greetingNameDirty) return;
		greetingNameSaving = true;
		try {
			const saved = await greetingName.save(greetingNameInput, $auth.user.id);
			if (saved) {
				greetingNameTouched = false;
				toasts.show(translate(lang, 'auth.greetingNameSaved'), 'success');
			}
		} catch (err) {
			toasts.show(translateError(lang, err, 'auth.greetingNameSaveFail'), 'error');
		} finally {
			greetingNameSaving = false;
		}
	}

	function openAvatarSheet() {
		if (avatarBusy || !$auth.configured) return;
		/* Sheet only when Remove is available; otherwise one extra tap before the picker. */
		if (!hasCustomAvatar) {
			openAvatarFilePicker();
			return;
		}
		avatarSheetOpen = true;
	}

	function openAvatarFilePicker() {
		avatarFileInput?.click();
	}

	async function onAvatarFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		input.value = '';
		if (!file || avatarBusy) return;
		avatarCropFile = file;
		avatarCropOpen = true;
	}

	async function saveCroppedAvatar(cropped: File) {
		if (avatarBusy) return;
		avatarBusy = true;
		try {
			await auth.uploadProfileAvatar(cropped);
			toasts.show(translate(lang, 'auth.avatar.saved'), 'success');
			avatarCropOpen = false;
			avatarCropFile = null;
		} catch (err) {
			toasts.show(translateError(lang, err, 'auth.avatar.uploadFail'), 'error');
		} finally {
			avatarBusy = false;
		}
	}

	function dismissAvatarCrop() {
		if (avatarBusy) return;
		avatarCropOpen = false;
		avatarCropFile = null;
	}

	async function removeCustomAvatar() {
		if (avatarBusy || !hasCustomAvatar) return;
		avatarBusy = true;
		try {
			await auth.removeProfileAvatar();
			toasts.show(translate(lang, 'auth.avatar.removed'), 'success');
			avatarRemoveOpen = false;
		} catch (err) {
			toasts.show(translateError(lang, err, 'auth.avatar.removeFail'), 'error');
		} finally {
			avatarBusy = false;
		}
	}

</script>

<SeoHead title={translate(lang, accountMode ? 'nav.profile' : 'nav.user')} noindex />

<section
	class="auth-page content-page"
	class:auth-page--account={accountMode && !showBootSkeleton && !isBootLoading}
	class:auth-page--booting={showBootSkeleton}
	class:auth-page--booting-account={showBootSkeleton && showAccountSkeleton}
	class:auth-page--booting-guest={showBootSkeleton && showGuestSkeleton}
>
	{#if $auth.ready && $auth.sessionKnown && !showBootSkeleton}
		{#if accountMode}
			<ScreenHeader
				fixed
				title={translate(lang, 'nav.profile')}
				backHref={nextPath}
				backLabel={backLabel}
				backLabelVisible
			/>
		{:else if !recoveryMode}
			<ScreenHeader title={translate(lang, 'nav.user')} backHref={nextPath} />
		{/if}
	{/if}
	{#if $auth.ready && $auth.sessionKnown && !accountMode && !showBootSkeleton}
		<header class="page-header page-header--compact auth-page__header">
			{#if guestExtrasMode}
				<BrandTagline class="brand-tagline--auth" />
			{/if}
		</header>
	{/if}

	{#if showBootSkeleton}
		<PageSkeleton variant={showAccountSkeleton ? 'auth' : 'auth-guest'} rows={2} />
	{:else if isBootLoading}
		<!-- Delay window: no skeleton, no auth UI (avoids FOLS). -->
	{:else if showCloudOff}
		<div class="auth-guest-stack">
			<div class="auth-signin profile-settings-group panel">
				<p class="text-sm font-semibold">{translate(lang, 'auth.cloudOffTitle')}</p>
				<p class="mt-2 text-sm text-[var(--color-muted)]">{translate(lang, 'auth.cloudOffLead')}</p>
			</div>
			{@render guestSettingsPanel()}
		</div>
	{:else if recoveryMode}
		<div class="auth-panel panel">
			<form
				class="auth-panel__primary auth-form"
				onsubmit={(e) => {
					e.preventDefault();
					void submitRecovery();
				}}
			>
				<p class="text-sm font-semibold">{translate(lang, 'auth.recoveryTitle')}</p>
				<p class="text-sm text-[var(--color-muted)]">{translate(lang, 'auth.recoveryLead')}</p>
				<div class="auth-form__fields">
					<PasswordField
						bind:value={password}
						label={translate(lang, 'auth.newPassword')}
						placeholder={translate(lang, 'auth.passwordPh')}
						autocomplete="new-password"
						invalid={fieldsInvalid}
						oninput={clearConfirmMismatch}
					/>
					<PasswordPolicyHints password={password} email={$auth.user?.email ?? email} />
					<PasswordField
						bind:value={passwordConfirm}
						label={translate(lang, 'auth.passwordConfirm')}
						placeholder={translate(lang, 'auth.passwordConfirmPh')}
						autocomplete="new-password"
						invalid={fieldsInvalid || confirmMismatchVisible}
						onblur={onConfirmPasswordBlur}
						oninput={clearConfirmMismatch}
					/>
					{#if confirmMismatchHint}
						<p class="auth-form__error" role="status">{confirmMismatchHint}</p>
					{/if}
					{#if message}
						<p class="auth-form__error" role="alert">{message}</p>
					{/if}
				</div>
				<div class="auth-form__actions">
					<AppButton type="submit" block disabled={loading}>
						{#if loading}
							<span class="inline-flex items-center gap-2">
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							</span>
						{:else}
							{translate(lang, 'auth.submitNewPassword')}
						{/if}
					</AppButton>
				</div>
			</form>
		</div>
	{:else if $auth.user}
		<div class="auth-account">
			<header class="profile-hero">
				<div class="profile-hero__stage">
					<div class="profile-hero__glow" aria-hidden="true"></div>
					<button
						type="button"
						class="profile-hero__avatar-btn"
						aria-label={translate(lang, 'auth.avatar.editAria')}
						disabled={avatarBusy || !$auth.configured}
						onclick={openAvatarSheet}
					>
						<span class="profile-hero__avatar-wrap">
							{#if showProfilePhoto && profileAvatar}
								<img
									class="account-avatar is-photo profile-hero__avatar"
									src={profileAvatar}
									alt=""
									width="96"
									height="96"
									referrerpolicy="no-referrer"
									decoding="async"
									onerror={() => {
										profileAvatarBroken = true;
									}}
								/>
							{:else if profileInitials}
								<span class="account-avatar profile-hero__avatar" aria-hidden="true"
									>{profileInitials}</span
								>
							{:else}
								<span class="account-avatar is-guest profile-hero__avatar" aria-hidden="true">
									<LucideIcon icon={UserRound} size={40} />
								</span>
							{/if}
							{#if avatarBusy}
								<span class="profile-hero__avatar-busy" aria-hidden="true">
									<Spinner size="sm" block={false} label="" />
								</span>
							{:else}
								<span class="profile-hero__camera-badge" aria-hidden="true">
									<LucideIcon icon={Camera} size={ICON_SMALL} />
								</span>
							{/if}
						</span>
					</button>
				</div>

				<h2 class="profile-hero__name">
					<button
						type="button"
						class="profile-hero__copy"
						title={translate(lang, 'profile.copyNameAria')}
						aria-label={translate(lang, 'profile.copyNameAria')}
						onclick={() => void copyProfileValue(profileName || profileEmail, 'name')}
					>
						{profileName || $auth.user.email}
					</button>
				</h2>
				{#if profileName && $auth.user.email}
					<p class="profile-hero__meta">
						<button
							type="button"
							class="profile-hero__copy"
							title={translate(lang, 'profile.copyEmailAria')}
							aria-label={translate(lang, 'profile.copyEmailAria')}
							onclick={() => void copyProfileValue(profileEmail, 'email')}
						>
							{$auth.user.email}
						</button>
					</p>
				{/if}
				{#if profileProviderLabel}
					<span class="auth-provider-badge profile-hero__badge">{profileProviderLabel}</span>
				{/if}
			</header>

			<ProfileAvatarSheet
				open={avatarSheetOpen}
				canRemove={hasCustomAvatar}
				busy={avatarBusy}
				onChangePhoto={openAvatarFilePicker}
				onRemovePhoto={() => {
					avatarRemoveOpen = true;
				}}
				onDismiss={() => {
					avatarSheetOpen = false;
				}}
			/>

			<AvatarCropSheet
				open={avatarCropOpen}
				file={avatarCropFile}
				busy={avatarBusy}
				onConfirm={(file) => void saveCroppedAvatar(file)}
				onDismiss={dismissAvatarCrop}
			/>

			<BottomSheet
				bind:open={avatarRemoveOpen}
				titleId="avatar-remove-title"
				dismissible={!avatarBusy}
				onDismiss={() => {
					avatarRemoveOpen = false;
				}}
			>
				<p id="avatar-remove-title" class="bottom-sheet__title">
					{translate(lang, 'auth.avatar.removeConfirmTitle')}
				</p>
				<p class="bottom-sheet__hint">{translate(lang, 'auth.avatar.removeConfirmHint')}</p>
				{#snippet actions()}
					<AppButton
						variant="secondary"
						disabled={avatarBusy}
						onclick={() => {
							avatarRemoveOpen = false;
						}}
					>
						{translate(lang, 'common.cancel')}
					</AppButton>
					<AppButton
						variant="danger"
						disabled={avatarBusy}
						aria-busy={avatarBusy}
						onclick={() => void removeCustomAvatar()}
					>
						{#if avatarBusy}
							<span class="inline-flex items-center gap-2">
								<Spinner size="sm" block={false} />
								{translate(lang, 'auth.wait')}
							</span>
						{:else}
							{translate(lang, 'common.delete')}
						{/if}
					</AppButton>
				{/snippet}
			</BottomSheet>

			<div class="profile-settings-stack">
				<div class="profile-settings-cols">
					<div class="profile-settings-col">
						<form
							id="auth-greeting-panel"
							class="profile-settings-group panel profile-settings-group--compact"
							onsubmit={(e) => {
								e.preventDefault();
								void saveGreetingName();
							}}
						>
							<p class="profile-settings-group__title">{translate(lang, 'auth.greetingNameLabel')}</p>
							<AppInput
								id="auth-greeting-name"
								class="profile-settings-group__field"
								type="text"
								autocomplete="nickname"
								maxlength={GREETING_NAME_MAX}
								placeholder={translate(lang, 'auth.greetingNamePh')}
								value={greetingNameInput}
								aria-label={translate(lang, 'auth.greetingNameLabel')}
								oninput={(e) => {
									const el = e.currentTarget as HTMLInputElement;
									const next = clampGreetingName(el.value);
									greetingNameInput = next;
									greetingNameTouched = true;
									if (el.value !== next) el.value = next;
								}}
							/>
							<p class="profile-settings-group__hint">{translate(lang, 'auth.greetingNameHint')}</p>
							<AppButton
								type="submit"
								variant={greetingNameDirty ? 'primary' : 'secondary'}
								class="profile-settings-group__action"
								disabled={greetingNameSaving || !greetingNameDirty}
							>
								{#if greetingNameSaving}
									<span class="inline-flex items-center gap-2">
										<Spinner size="sm" block={false} />
										{translate(lang, 'auth.wait')}
									</span>
								{:else}
									{translate(lang, 'auth.greetingNameSave')}
								{/if}
							</AppButton>
						</form>

						<div class="profile-settings-group panel profile-settings-group--compact">
							<p class="profile-settings-group__title">{translate(lang, 'settings.sessionTitle')}</p>
							<ProfileSettingsRow icon={Timer} label={translate(lang, 'settings.restSound')}>
								<input
									type="checkbox"
									class="auth-pref-toggle__input profile-settings-row__toggle"
									checked={$restSoundEnabled}
									aria-label={translate(lang, 'settings.restSound')}
									onchange={(e) => {
										restSoundEnabled.set((e.currentTarget as HTMLInputElement).checked);
									}}
								/>
							</ProfileSettingsRow>
							<ProfileSettingsRow icon={DeviceMobile} label={translate(lang, 'profile.hapticRest')}>
								<input
									type="checkbox"
									class="auth-pref-toggle__input profile-settings-row__toggle"
									checked={$restHapticEnabled}
									aria-label={translate(lang, 'profile.hapticRest')}
									onchange={(e) => {
										restHapticEnabled.set((e.currentTarget as HTMLInputElement).checked);
									}}
								/>
							</ProfileSettingsRow>
							<p class="profile-settings-group__hint">{translate(lang, restSoundHintKey)}</p>
						</div>
					</div>

					<div class="profile-settings-col">
						<AuthInterfacePrefs surface="panel" />
						{@render onboardingAuthHelpCard()}
					</div>
				</div>

				<div class="profile-settings-stack-full">
					<ProfileInsightsPanel />
					<div class="profile-settings-group panel text-left">
						<p class="profile-settings-group__title">{translate(lang, 'profile.clients')}</p>

						{#if currentAssignment}
							<div class="coach-assigned">
								<div class="coach-assigned__head">
									<IconPlate icon={ClipboardText} tone="accent" />
									<div class="coach-assigned__text">
										<p class="coach-assigned__title">
											{translate(lang, 'coach.assignedTitle')}
										</p>
										<p class="coach-assigned__body">
											{currentAssignment.planName}
											{#if currentAssignment.coachName}
												· {currentAssignment.coachName}
											{/if}
										</p>
									</div>
								</div>
								<div class="coach-assigned__actions">
									<AppButton
										block
										disabled={assignmentBusy}
										onclick={() => void importAssignment()}
									>
										{translate(lang, 'coach.assignedAdd')}
									</AppButton>
									<AppButton
										variant="ghost"
										disabled={assignmentBusy}
										onclick={() => void dismissAssignment()}
									>
										{translate(lang, 'coach.assignedDismiss')}
									</AppButton>
								</div>
							</div>
						{/if}

						<ProfileSettingsRow
							icon={myCoaches.length > 0 ? UserCheck : UserRound}
							label={translate(lang, 'profile.myCoach')}
							hint={coachRowValue || undefined}
							onclick={() => (coachSheetOpen = true)}
						/>

						<div class="profile-settings-group__section profile-settings-group__section--row">
							<ProfileSettingsRow
								icon={UsersThree}
								label={translate(lang, 'profile.clientsRow')}
								href="/clients"
							/>
						</div>
					</div>
					{#if !onboardingComplete}
						<OnboardingChecklist readonly onTryDemo={() => {}} />
					{/if}
				</div>

				<div class="profile-settings-group panel profile-settings-group--data profile-settings-stack-full">
					<p class="profile-settings-group__title">{translate(lang, 'settings.exportTitle')}</p>
					<p class="profile-settings-group__hint">{translate(lang, 'settings.exportHint')}</p>
					<DataExportSection embedded />
				</div>

				{#if showTesterTools}
					<LoopMetricsPanel />
					<ProfileDevWipePanel />
				{/if}

				<div
					class="auth-danger-zone profile-settings-stack-full"
					class:auth-danger-zone--open={deleteZoneOpen}
				>
					<button
						type="button"
						class="auth-danger-zone__disclosure"
						aria-expanded={deleteZoneOpen}
						aria-controls={deleteZoneOpen ? 'auth-danger-body' : undefined}
						disabled={accountLocked}
						onclick={toggleDeleteZone}
					>
						<span class="auth-danger-zone__disclosure-text">
							<span class="auth-danger-zone__eyebrow">
								{translate(lang, 'auth.deleteZoneLabel')}
							</span>
							<span id="auth-danger-title" class="auth-danger-zone__title">
								{translate(lang, 'auth.deleteTitle')}
							</span>
						</span>
						<LucideIcon
							icon={ChevronDown}
							size={ICON_SMALL}
							class="auth-danger-zone__chevron"
						/>
					</button>

					{#if deleteZoneOpen}
						<div id="auth-danger-body" class="auth-danger-zone__body">
							<p class="auth-danger-zone__lead">{translate(lang, 'auth.deleteLead')}</p>
							<ul class="auth-danger-zone__list">
								<li>{translate(lang, 'auth.deleteBulletPlans')}</li>
								<li>{translate(lang, 'auth.deleteBulletRecords')}</li>
								<li>{translate(lang, 'auth.deleteBulletSessions')}</li>
								<li>{translate(lang, 'auth.deleteBulletClips')}</li>
							</ul>

							{#if !deleteConfirmOpen}
								<AppButton
									variant="danger"
									class="auth-danger-zone__trigger"
									disabled={accountLocked}
									onclick={openDeleteConfirm}
								>
									{translate(lang, 'auth.deleteButton')}
								</AppButton>
							{:else}
								<div
									class="auth-danger-zone__confirm"
									role="group"
									aria-labelledby="auth-delete-confirm-hint"
								>
									<AppLabel for="auth-delete-confirm">
										<span id="auth-delete-confirm-hint">
											{translate(lang, 'auth.deleteConfirmHint', {
												word: deleteConfirmWord
											})}
										</span>
										<AppInput
											id="auth-delete-confirm"
											class="mt-1 w-full"
											type="text"
											autocomplete="off"
											autocapitalize="characters"
											spellcheck="false"
											placeholder={deleteConfirmWord}
											bind:value={deleteConfirmText}
											disabled={accountLocked}
											onkeydown={(e) => {
												if (e.key === 'Escape') cancelDeleteConfirm();
											}}
										/>
									</AppLabel>
									<div class="auth-danger-zone__confirm-actions">
										<AppButton
											variant="secondary"
											disabled={accountLocked}
											onclick={cancelDeleteConfirm}
										>
											{translate(lang, 'auth.deleteCancel')}
										</AppButton>
										<AppButton
											variant="danger"
											disabled={accountLocked || !deleteConfirmReady}
											aria-busy={accountBusy === 'delete'}
											onclick={deleteAccount}
										>
											{#if accountBusy === 'delete'}
												<span class="inline-flex items-center gap-2">
													<Spinner size="sm" block={false} />
													{translate(lang, 'auth.deleteButtonFinal')}
												</span>
											{:else}
												{translate(lang, 'auth.deleteButtonFinal')}
											{/if}
										</AppButton>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<div
					class="profile-settings-group profile-settings-group--account panel profile-settings-stack-full"
					class:profile-settings-group--busy={accountLocked}
					aria-busy={accountLocked || undefined}
				>
					<p class="profile-settings-group__title">{translate(lang, 'settings.accountTitle')}</p>
					<ProfileSettingsRow
						icon={FileText}
						iconTone="accent"
						label={translate(lang, 'terms.link')}
						href="/terms"
						disabled={accountLocked}
					/>
					<ProfileSettingsRow
						icon={ShieldCheck}
						iconTone="accent"
						label={translate(lang, 'privacy.link')}
						href="/privacy"
						disabled={accountLocked}
					/>
					<ProfileSettingsRow
						icon={SignOut}
						iconTone="accent"
						label={translate(lang, 'auth.logout')}
						ariaLabel={translate(lang, 'auth.logout')}
						busy={accountBusy === 'logout'}
						disabled={accountLocked}
						onclick={openLogoutConfirm}
					/>
					<div class="profile-settings-group__session-footer">
						<div class="auth-session-note">
							<LucideIcon icon={Info} size={ICON_SMALL} class="auth-session-note__icon" />
							<p>{translate(lang, 'auth.logoutEverywhereHint')}</p>
						</div>
						<button
							type="button"
							class="profile-settings-group__text-action"
							disabled={accountLocked}
							aria-busy={accountBusy === 'logoutEverywhere' || undefined}
							onclick={openLogoutEverywhereConfirm}
						>
							{#if accountBusy === 'logoutEverywhere'}
								<span class="profile-settings-group__text-action-busy">
									<Spinner size="sm" block={false} />
									{translate(lang, 'auth.logoutEverywhere')}
								</span>
							{:else}
								{translate(lang, 'auth.logoutEverywhere')}
							{/if}
						</button>
					</div>
				</div>
			</div>
			<WhatsNewSheet />
			<!-- iOS anchors the native file-picker popup to this input's on-screen
			     frame. Keep it fixed at the bottom edge (1px, invisible) so the
			     popup appears near the thumb for both triggers: the avatar tap
			     and "Choose photo" in the sheet. -->
			<input
				bind:this={avatarFileInput}
				type="file"
				accept="image/*"
				class="profile-avatar-file-input"
				tabindex="-1"
				aria-hidden="true"
				onchange={onAvatarFileChange}
			/>
		</div>
	{:else if panel === 'check-email'}
		<div class="auth-guest-stack">
			<div class="auth-signin profile-settings-group panel flex flex-col gap-3">
				<p class="font-semibold">{translate(lang, 'auth.checkEmailTitle')}</p>
				<p class="text-sm text-[var(--color-muted)]">
					{#if checkEmailKind === 'magic'}
						{translate(lang, 'auth.checkEmailMagic', { email: email.trim() })}
					{:else if checkEmailKind === 'reset'}
						{translate(lang, 'auth.checkEmailReset', { email: email.trim() })}
					{:else}
						{translate(lang, 'auth.checkEmailSignup', { email: email.trim() })}
					{/if}
				</p>
				{#if checkEmailKind === 'signup' || checkEmailKind === 'magic'}
					<p class="text-sm leading-relaxed text-[var(--color-muted)]">
						{translate(lang, 'auth.checkEmailPwaHint')}
					</p>
				{/if}
				<AppButton variant="secondary" block onclick={() => setPanel('signin')}>
					{translate(lang, 'auth.backToSignIn')}
				</AppButton>
			</div>
			{@render guestSettingsPanel()}
		</div>
	{:else}
		<div class="auth-guest-stack">
			<div class="auth-signin profile-settings-group panel flex flex-col gap-4">
			{#if panel === 'magic'}
				<form
					class="auth-form"
					onsubmit={(e) => {
						e.preventDefault();
						void submitMagic();
					}}
				>
					<p class="text-sm leading-relaxed text-[var(--color-muted)]">{translate(lang, 'auth.magicLead')}</p>
					<div class="auth-form__fields">
						<AppLabel>
							{translate(lang, 'auth.email')}
							<AppInput
								class="mt-1 w-full"
								aria-invalid={fieldsInvalid || undefined}
								type="email"
								required
								autocomplete="email"
								inputmode="email"
								placeholder={translate(lang, 'auth.emailPh')}
								bind:value={email}
							/>
						</AppLabel>
						{#if message}
							<p class="auth-form__error" role="alert">{message}</p>
						{/if}
					</div>
					{#if turnstileOn}
						<TurnstileWidget bind:token={captchaToken} resetSignal={captchaReset} />
					{/if}
					<AuthLegalConsent bind:checked={legalAccepted} />
					<div class="auth-form__actions">
						<AppButton type="submit" block disabled={loading || !legalAccepted}>
							{#if loading}
								<span class="inline-flex items-center justify-center gap-2">
									<Spinner size="sm" block={false} />
									{translate(lang, 'auth.wait')}
								</span>
							{:else}
								{translate(lang, 'auth.submitMagic')}
							{/if}
						</AppButton>
						<AppButton variant="link" class="auth-form__back" onclick={() => setPanel('signin')}>
							{translate(lang, 'auth.backToPassword')}
						</AppButton>
					</div>
				</form>
			{:else if panel !== 'forgot'}
				<div class="auth-segments" role="tablist" aria-label={translate(lang, 'auth.modeAria')}>
					<button
						type="button"
						class="auth-segment"
						class:is-active={passwordMode === 'signin'}
						role="tab"
						aria-selected={passwordMode === 'signin'}
						onclick={() => setPasswordMode('signin')}
					>
						{translate(lang, 'auth.signInTab')}
					</button>
					<button
						type="button"
						class="auth-segment"
						class:is-active={passwordMode === 'signup'}
						role="tab"
						aria-selected={passwordMode === 'signup'}
						onclick={() => setPasswordMode('signup')}
					>
						{translate(lang, 'auth.signUpTab')}
					</button>
				</div>
			{/if}

			{#if panel === 'signin' || panel === 'signup'}
				<form
					class="auth-form"
					onsubmit={(e) => {
						e.preventDefault();
						void submitPassword();
					}}
				>
					<div class="auth-form__fields">
						<AppLabel>
							{translate(lang, 'auth.email')}
							<AppInput
								class="mt-1 w-full"
								aria-invalid={fieldsInvalid || undefined}
								type="email"
								required
								autocomplete="email"
								inputmode="email"
								placeholder={translate(lang, 'auth.emailPh')}
								bind:value={email}
							/>
						</AppLabel>
						<PasswordField
							bind:value={password}
							label={translate(lang, 'auth.password')}
							placeholder={translate(lang, 'auth.passwordPh')}
							autocomplete={passwordMode === 'signup' ? 'new-password' : 'current-password'}
							invalid={fieldsInvalid}
							oninput={passwordMode === 'signup' ? clearConfirmMismatch : undefined}
						/>
						{#if passwordMode === 'signup'}
							<PasswordPolicyHints {password} {email} />
							<PasswordField
								bind:value={passwordConfirm}
								label={translate(lang, 'auth.passwordConfirm')}
								placeholder={translate(lang, 'auth.passwordConfirmPh')}
								autocomplete="new-password"
								invalid={fieldsInvalid || confirmMismatchVisible}
								onblur={onConfirmPasswordBlur}
								oninput={clearConfirmMismatch}
							/>
							{#if confirmMismatchHint}
								<p class="auth-form__error" role="status">{confirmMismatchHint}</p>
							{/if}
						{/if}
						{#if message}
							<p class="auth-form__error" role="alert">{message}</p>
						{/if}
					</div>

					{#if passwordMode === 'signin'}
						<AppButton
							variant="link"
							class="auth-form__alt auth-form__forgot self-start text-sm"
							onclick={() => setPanel('forgot')}
						>
							{translate(lang, 'auth.forgot')}
						</AppButton>
					{/if}

					{#if turnstileOn}
						<TurnstileWidget bind:token={captchaToken} resetSignal={captchaReset} />
					{/if}

					{#if passwordMode === 'signup'}
						<AuthLegalConsent bind:checked={legalAccepted} />
					{/if}

					<div class="auth-form__actions">
						<AppButton
							type="submit"
							block
							disabled={loading || (passwordMode === 'signup' && !legalAccepted)}
						>
							{#if loading}
								<span class="inline-flex items-center justify-center gap-2">
									<Spinner size="sm" block={false} />
									{translate(lang, 'auth.wait')}
								</span>
							{:else}
								{passwordMode === 'signup'
									? translate(lang, 'auth.submitSignUp')
									: translate(lang, 'auth.submitSignIn')}
							{/if}
						</AppButton>
						<AppButton
							variant="link"
							class="auth-form__alt auth-form__alt--center"
							onclick={openMagicLink}
						>
							{translate(lang, 'auth.useMagicLink')}
						</AppButton>
					</div>
				</form>
			{:else if panel === 'forgot'}
				<form
					class="auth-form"
					onsubmit={(e) => {
						e.preventDefault();
						void submitForgot();
					}}
				>
					<p class="text-sm font-semibold text-[var(--color-ink)]">{translate(lang, 'auth.forgot')}</p>
					<p class="text-sm leading-relaxed text-[var(--color-muted)]">{translate(lang, 'auth.forgotLead')}</p>
					<div class="auth-form__fields">
						<AppLabel>
							{translate(lang, 'auth.email')}
							<AppInput
								class="mt-1 w-full"
								aria-invalid={fieldsInvalid || undefined}
								type="email"
								required
								autocomplete="email"
								inputmode="email"
								placeholder={translate(lang, 'auth.emailPh')}
								bind:value={email}
							/>
						</AppLabel>
						{#if message}
							<p class="auth-form__error" role="alert">{message}</p>
						{/if}
					</div>
					{#if turnstileOn}
						<TurnstileWidget bind:token={captchaToken} resetSignal={captchaReset} />
					{/if}
					<div class="auth-form__actions">
						<AppButton type="submit" block disabled={loading}>
							{#if loading}
								<span class="inline-flex items-center justify-center gap-2">
									<Spinner size="sm" block={false} />
									{translate(lang, 'auth.wait')}
								</span>
							{:else}
								{translate(lang, 'auth.submitReset')}
							{/if}
						</AppButton>
						<AppButton variant="secondary" block onclick={() => setPanel('signin')}>
							{translate(lang, 'auth.backToSignIn')}
						</AppButton>
					</div>
				</form>
			{/if}
			</div>
			{@render guestSettingsPanel()}
		</div>
	{/if}
</section>

{#if $auth.user}
	<BottomSheet
		bind:open={coachSheetOpen}
		titleId="coach-my-title"
		label={translate(lang, 'profile.myCoach')}
		raised={myCoaches.length === 0}
		dismissible={!coachInviteBusy}
		onDismiss={() => (coachSheetOpen = false)}
	>
		<p id="coach-my-title" class="bottom-sheet__title">{translate(lang, 'profile.myCoach')}</p>
		{#if coachCloud && !clientCoachLoaded}
			<p class="bottom-sheet__hint">…</p>
		{:else if myCoaches.length > 0}
			<ul class="coach-my-list">
				{#each myCoaches as coach (coach.linkId)}
					<li class="coach-connect-status">
						<IconPlate icon={UserCheck} tone="accent" />
						<div class="coach-connect-status__text">
							<p class="coach-connect-status__title">{coachDisplayName(coach)}</p>
							<p class="coach-connect-status__hint">
								{translate(lang, 'coach.connectedOn', {
									when: formatRelativeDay(coach.createdAt, lang)
								})}
							</p>
							<p class="coach-connect-status__hint">
								{translate(lang, 'profile.coachConnectedHint')}
							</p>
							<AppButton
								variant="ghost"
								class="is-danger mt-1 !min-h-[48px]"
								disabled={disconnectBusy}
								onclick={() => {
									coachSheetOpen = false;
									requestDisconnectCoach(coach);
								}}
							>
								{translate(lang, 'coach.disconnect')}
							</AppButton>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="bottom-sheet__hint">{translate(lang, 'coach.inviteAcceptLead')}</p>
			<form
				class="coach-connect-form"
				onsubmit={(e) => {
					e.preventDefault();
					void acceptCoachInvite();
				}}
			>
				<AppInput
					type="text"
					inputmode="text"
					autocomplete="off"
					autocapitalize="characters"
					enterkeyhint="done"
					maxlength={INVITE_CODE_LENGTH + 1}
					spellcheck={false}
					class="w-full font-mono tracking-[0.12em]"
					placeholder={translate(lang, 'coach.inviteAcceptPlaceholder')}
					aria-label={translate(lang, 'coach.inviteAcceptLabel')}
					aria-invalid={coachInviteError ? 'true' : undefined}
					aria-describedby={coachInviteError ? 'coach-invite-error' : undefined}
					value={coachInviteInput}
					oninput={(e) => onCoachInviteInput(e.currentTarget)}
				/>
				<AppButton type="submit" block disabled={coachInviteBusy || !coachInviteHasChars}>
					{#if coachInviteBusy}
						<span class="inline-flex items-center gap-2">
							<Spinner size="sm" block={false} />
							{translate(lang, 'auth.wait')}
						</span>
					{:else}
						{translate(lang, 'coach.inviteAcceptCta')}
					{/if}
				</AppButton>
			</form>
			{#if coachInviteError}
				<p id="coach-invite-error" class="coach-connect-form__error" role="alert">
					{coachInviteError}
				</p>
			{/if}
		{/if}
	</BottomSheet>
	<ConfirmSheet
		open={disconnectTarget !== null}
		titleId="coach-disconnect-title"
		title={translate(lang, 'coach.disconnectConfirmTitle')}
		hint={translate(lang, 'coach.disconnectConfirmLead', {
			name: disconnectTarget ? coachDisplayName(disconnectTarget) : ''
		})}
		confirmLabel={translate(lang, 'coach.disconnect')}
		busy={disconnectBusy}
		onConfirm={confirmDisconnectCoach}
		onDismiss={dismissDisconnectCoach}
	/>
	<ConfirmSheet
		open={logoutConfirmOpen}
		titleId="auth-logout-title"
		title={translate(lang, 'auth.logoutConfirmTitle')}
		hint={translate(lang, 'auth.logoutConfirmLead')}
		confirmLabel={translate(lang, 'auth.logout')}
		variant="primary"
		busy={accountBusy === 'logout'}
		onConfirm={() => {
			logoutConfirmOpen = false;
			void logout();
		}}
		onDismiss={dismissLogoutConfirm}
	/>
	<BottomSheet
		open={logoutEverywhereConfirmOpen}
		titleId="auth-logout-everywhere-title"
		onDismiss={dismissLogoutEverywhereConfirm}
	>
		<p id="auth-logout-everywhere-title" class="bottom-sheet__title">
			{translate(lang, 'auth.logoutEverywhereConfirmTitle')}
		</p>
		<p class="bottom-sheet__hint">{translate(lang, 'auth.logoutEverywhereConfirmLead')}</p>
		{#snippet actions()}
			<AppButton variant="secondary" onclick={dismissLogoutEverywhereConfirm}>
				{translate(lang, 'common.cancel')}
			</AppButton>
			<AppButton
				variant="danger"
				onclick={() => {
					void logoutEverywhere();
				}}
				disabled={accountLocked}
				aria-busy={accountBusy === 'logoutEverywhere'}
			>
				{#if accountBusy === 'logoutEverywhere'}
					<span class="inline-flex items-center gap-2">
						<Spinner size="sm" block={false} />
						{translate(lang, 'auth.logoutEverywhereConfirmAction')}
					</span>
				{:else}
					{translate(lang, 'auth.logoutEverywhereConfirmAction')}
				{/if}
			</AppButton>
		{/snippet}
	</BottomSheet>
{/if}

{#snippet guestSettingsPanel()}
	{@render onboardingAuthHelpCard()}
	{#if !onboardingComplete}
		<OnboardingChecklist readonly onTryDemo={() => {}} />
	{/if}
	<AuthInterfacePrefs surface="panel" />
	<ProfileInsightsPanel />
	<div class="profile-settings-group panel profile-settings-group--data">
		<p class="profile-settings-group__title">{translate(lang, 'settings.exportTitle')}</p>
		<p class="profile-settings-group__hint">{translate(lang, 'settings.exportHint')}</p>
		<DataExportSection embedded />
	</div>
	{#if showTesterTools}
		<LoopMetricsPanel />
		<ProfileDevWipePanel />
	{/if}
	<div class="profile-settings-group panel">
		<p class="profile-settings-group__title">{translate(lang, 'auth.privacyHint')}</p>
		<div class="auth-prefs__stack">
			<ProfileSettingsRow
				icon={FileText}
				iconTone="accent"
				label={translate(lang, 'terms.link')}
				href="/terms"
			/>
			<ProfileSettingsRow
				icon={ShieldCheck}
				iconTone="accent"
				label={translate(lang, 'privacy.link')}
				href="/privacy"
			/>
		</div>
	</div>
	<WhatsNewSheet />
{/snippet}

{#snippet onboardingAuthHelpCard()}
	<div class="profile-settings-group panel onboarding-auth-help">
		<p class="profile-settings-group__title">{translate(lang, 'onboarding.authHelp')}</p>
		<p class="profile-settings-group__hint">{translate(lang, 'onboarding.authHelpLead')}</p>
		<AppButton variant="secondary" block href="/articles">
			{translate(lang, 'articles.viewAll')}
		</AppButton>
	</div>
{/snippet}
