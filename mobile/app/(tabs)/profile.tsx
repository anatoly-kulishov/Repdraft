import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import {
	Alert,
	Image,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	View
} from 'react-native';
import { ChevronDown, UserRound } from 'lucide-react-native';
import type { Session } from '@supabase/supabase-js';
import { userCustomAvatarPath, userDisplayName } from '@repdraft/domain/authFlow';
import {
	INVITE_CODE_LENGTH,
	isValidInviteCode,
	normalizeInviteCode,
	type CoachAssignment,
	type CoachMyCoach
} from '@repdraft/domain/coach';
import { clampGreetingName } from '@repdraft/domain/greetingName';
import { coachBadgeVisible } from '@repdraft/domain/coachHints';
import { buildExportPayload, exportPayloadToJson } from '@repdraft/domain/exportData';
import {
	computeLoopMetrics,
	formatRatePercent,
	type LoopMetricsSnapshot
} from '@repdraft/domain/loopMetrics';
import {
	deleteCloudAccount,
	removeAvatarRemote,
	signOutEverywhere,
	uploadAvatarMultipart
} from '../../src/auth/accountApi';
import { resolveUserAvatarUrl } from '../../src/auth/avatarUrl';
import { authEmailRedirect } from '../../src/auth/emailLink';
import { unlockRestAudioFromGesture, playRestDoneChime } from '../../src/audio/restChime';
import { webOrigin } from '../../src/catalog/mediaUrl';
import { getSupabase, isSupabaseConfigured } from '../../src/auth/supabase';
import type { WorkoutSession } from '@repdraft/domain/types';
import { checklistProgress, type OnboardingState } from '@repdraft/domain/onboarding';
import { authErrorMessageKey } from '@repdraft/domain/authFlow';
import {
	passwordPolicyMessageKey,
	validatePasswordPolicy
} from '@repdraft/domain/passwordPolicy';
import { TESTER_MODE_UNLOCK_TAPS } from '@repdraft/domain/prefs';
import { BottomSheet } from '../../src/components/BottomSheet';
import { ConfirmSheet } from '../../src/components/ConfirmSheet';
import { ProfileAvatarSheet } from '../../src/components/ProfileAvatarSheet';
import { OnboardingChecklistPanel } from '../../src/components/OnboardingChecklistPanel';
import { Panel } from '../../src/components/Panel';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { WhatsNewSheet } from '../../src/components/WhatsNewSheet';
import { getHealthAdapter } from '../../src/health';
import { loadGreetingName, saveGreetingName as persistGreetingName } from '../../src/state/greetingName';
import { loadCoachSeenAt } from '../../src/state/coachHints';
import { isHealthReadEnabled, setHealthReadEnabled } from '../../src/state/healthPrefs';
import { useLocale } from '../../src/state/locale';
import { useTabScreenPad } from '../../src/layout/safe';
import { useAppColors, useAppTheme } from '../../src/state/theme';
import { applyBackupImport, parseImportText } from '../../src/storage/backup';
import { loadExerciseIndex } from '../../src/catalog/loadIndex';
import {
	normalizeExerciseName,
	parseCsvImport,
	suggestCatalogCandidates
} from '@repdraft/domain/importCsv';
import { customsRepo } from '../../src/storage/customsRepo';
import { formatRelativeDay } from '@repdraft/i18n/format';
import { coachRepo } from '../../src/storage/coachRepo';
import { AssignedPlanCard } from '../../src/coach/AssignedPlanCard';
import { importAssignedPlan } from '../../src/coach/importAssignment';
import { plansRepo } from '../../src/storage/plansRepo';
import { recordsRepo } from '../../src/storage/recordsRepo';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import {
	isHapticRestEnabled,
	isRestSoundEnabled,
	setHapticRestEnabled,
	setRestSoundEnabled
} from '../../src/state/prefs';
import { loadOnboarding } from '../../src/state/onboarding';
import { isTesterModeEnabled, setTesterModeEnabled } from '../../src/state/testerPrefs';
import { outboxCount, pullAndMergeFromCloud } from '../../src/sync/cloudSync';
import { wipeMobileAppStorage } from '../../src/storage/wipeAppStorage';
import { fontFamily, radius, space, touchMin, type, type ColorPalette } from '../../src/theme';

const APP_VERSION =
	Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '0.22.0';

function boolLabel(tt: (k: string) => string, v: boolean | null): string {
	if (v == null) return '-';
	return tt(v ? 'loopMetrics.yes' : 'loopMetrics.no');
}

export default function ProfileScreen() {
	const router = useRouter();
	const { locale, setLocale, tt } = useLocale();
	const colors = useAppColors();
	const { mode, cycleMode } = useAppTheme();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const tabPad = useTabScreenPad(space.lg);
	const switchColors = useMemo(
		() => ({
			trackColor: { false: colors.border, true: colors.accent } as const,
			thumbColor: colors.accentInk
		}),
		[colors]
	);
	const [healthOn, setHealthOn] = useState(false);
	const healthAvailable = getHealthAdapter().isAvailable();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [session, setSession] = useState<Session | null>(null);
	const [busy, setBusy] = useState(false);
	const [loopSnap, setLoopSnap] = useState<LoopMetricsSnapshot | null>(null);
	const [pendingSync, setPendingSync] = useState(0);
	const [restSound, setRestSound] = useState(true);
	const [hapticRest, setHapticRest] = useState(true);
	const [greetingName, setGreetingNameState] = useState('');
	const [greetingNameInput, setGreetingNameInput] = useState('');
	const [legalAccepted, setLegalAccepted] = useState(false);
	const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
	const [whatsNewOpen, setWhatsNewOpen] = useState(false);
	const [deleteZoneOpen, setDeleteZoneOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [logoutOpen, setLogoutOpen] = useState(false);
	const [logoutEverywhereOpen, setLogoutEverywhereOpen] = useState(false);
	const [deleteWord, setDeleteWord] = useState('');
	const [importReview, setImportReview] = useState<{
		raw: string;
		names: string[];
		overrides: Record<string, string>;
	} | null>(null);
	const [avatarBusy, setAvatarBusy] = useState(false);
	const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
	const [copiedHint, setCopiedHint] = useState<string | null>(null);
	const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
	const [testerOn, setTesterOn] = useState(false);
	const [myCoaches, setMyCoaches] = useState<CoachMyCoach[]>([]);
	const [coachesLoaded, setCoachesLoaded] = useState(false);
	const [assignment, setAssignment] = useState<CoachAssignment | null>(null);
	const [assignmentBusy, setAssignmentBusy] = useState(false);
	const [coachInviteInput, setCoachInviteInput] = useState('');
	const [coachInviteBusy, setCoachInviteBusy] = useState(false);
	const [coachSheetOpen, setCoachSheetOpen] = useState(false);
	const [coachBadge, setCoachBadge] = useState(false);
	const [disconnectTarget, setDisconnectTarget] = useState<CoachMyCoach | null>(null);
	const versionUnlockTaps = useRef(0);
	const versionUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cloud = isSupabaseConfigured();
	const avatarUrl = session?.user ? resolveUserAvatarUrl(session.user) : null;
	const displayName = userDisplayName(session?.user ?? null);
	const onboardingProgress = onboarding ? checklistProgress(onboarding) : null;
	const onboardingComplete = Boolean(
		onboardingProgress && onboardingProgress.done >= onboardingProgress.total
	);
	const coachRowValue = !coachesLoaded
		? '…'
		: myCoaches.length === 0
			? tt('profile.coachNone')
			: myCoaches.length === 1
				? tt('profile.coachConnected')
				: tt('profile.coachesConnected', { n: myCoaches.length });

	useFocusEffect(
		useCallback(() => {
			void outboxCount().then(setPendingSync);
			void loadOnboarding().then(setOnboarding);
			void (async () => {
				const [seenAt, list] = await Promise.all([loadCoachSeenAt(), sessionsRepo.list()]);
				const lastFinishedAt = list.reduce<string | null>((latest, item) => {
					if (!item.finishedAt) return latest;
					return !latest || item.finishedAt > latest ? item.finishedAt : latest;
				}, null);
				setCoachBadge(coachBadgeVisible(lastFinishedAt, seenAt));
			})();
			if (!cloud || !session?.user) {
				setMyCoaches([]);
				setCoachesLoaded(false);
				setAssignment(null);
				return;
			}
			void coachRepo.listMyCoaches().then((result) => {
				if (result.ok) setMyCoaches(result.value);
				setCoachesLoaded(true);
			});
			void coachRepo.myCurrentAssignment().then((result) => {
				if (result.ok) setAssignment(result.value);
			});
		}, [cloud, session?.user?.id])
	);

	useEffect(() => {
		if (!testerOn) {
			setLoopSnap(null);
			return;
		}
		let cancelled = false;
		void sessionsRepo.list().then((list) => {
			if (!cancelled) setLoopSnap(computeLoopMetrics(list, new Date().toISOString()));
		});
		return () => {
			cancelled = true;
		};
	}, [testerOn]);

	useEffect(() => {
		let unsub: (() => void) | undefined;
		void (async () => {
			setHealthOn(await isHealthReadEnabled());
			const testerPref = await isTesterModeEnabled();
			setTesterOn(testerPref || __DEV__);
			setRestSound(await isRestSoundEnabled());
			setHapticRest(await isHapticRestEnabled());
			const sb = getSupabase();
			const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
			setSession(data.session ?? null);
			const name = await loadGreetingName(data.session?.user ?? null);
			setGreetingNameState(name);
			setGreetingNameInput(name);
			if (!sb) return;
			const { data: sub } = sb.auth.onAuthStateChange((_e, next) => {
				setSession(next);
				void loadGreetingName(next?.user ?? null).then((n) => {
					setGreetingNameState(n);
					setGreetingNameInput(n);
				});
			});
			unsub = () => sub.subscription.unsubscribe();
		})();
		return () => unsub?.();
	}, []);

	function showAuthError(error: unknown, fallback: string) {
		const key = authErrorMessageKey(error);
		Alert.alert(tt('common.error'), key ? tt(key) : fallback);
	}

	function coachDisplayName(coach: CoachMyCoach): string {
		return coach.coachName?.trim() || tt('profile.coachFallback');
	}

	function onCoachInviteChange(raw: string) {
		const cleaned = normalizeInviteCode(raw).slice(0, INVITE_CODE_LENGTH);
		const next = cleaned.length > 4 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : cleaned;
		setCoachInviteInput(next);
	}

	async function acceptCoachInvite() {
		if (coachInviteBusy) return;
		const code = normalizeInviteCode(coachInviteInput);
		if (!isValidInviteCode(code)) {
			Alert.alert(tt('common.error'), tt('coach.inviteInvalid'));
			return;
		}
		setCoachInviteBusy(true);
		try {
			const result = await coachRepo.acceptInvite(code);
			if (result.ok) {
				setCoachInviteInput('');
				Alert.alert(tt('coach.inviteAccepted'));
				const refreshed = await coachRepo.listMyCoaches();
				if (refreshed.ok) setMyCoaches(refreshed.value);
				const refreshedAssignment = await coachRepo.myCurrentAssignment();
				if (refreshedAssignment.ok) setAssignment(refreshedAssignment.value);
				setCoachesLoaded(true);
				setCoachSheetOpen(false);
			} else {
				Alert.alert(tt('common.error'), tt(`coach.error.${result.reason}`));
			}
		} finally {
			setCoachInviteBusy(false);
		}
	}

	async function disconnectCoach(coach: CoachMyCoach) {
		const result = await coachRepo.revokeAsClient(coach.linkId);
		if (result.ok) {
			setMyCoaches((prev) => prev.filter((row) => row.linkId !== coach.linkId));
			Alert.alert(tt('coach.disconnectDone'));
			const refreshed = await coachRepo.myCurrentAssignment();
			if (refreshed.ok) setAssignment(refreshed.value);
		} else {
			Alert.alert(tt('common.error'), tt(`coach.error.${result.reason}`));
		}
	}

	async function importCoachAssignment() {
		const current = assignment;
		if (!current || assignmentBusy) return;
		setAssignmentBusy(true);
		try {
			await importAssignedPlan(current);
			await coachRepo.discardAssignment();
			setAssignment(null);
			Alert.alert(tt('coach.assignedAdded'));
		} catch {
			Alert.alert(tt('common.error'), tt('coach.error.unknown'));
		} finally {
			setAssignmentBusy(false);
		}
	}

	async function dismissCoachAssignment() {
		if (!assignment || assignmentBusy) return;
		setAssignmentBusy(true);
		try {
			const result = await coachRepo.discardAssignment();
			if (result.ok) {
				setAssignment(null);
				Alert.alert(tt('coach.assignedDismissed'));
			} else {
				Alert.alert(tt('common.error'), tt(`coach.error.${result.reason}`));
			}
		} finally {
			setAssignmentBusy(false);
		}
	}

	async function toggleHealth(next: boolean) {
		setHealthOn(next);
		await setHealthReadEnabled(next);
		if (next && healthAvailable) {
			const adapter = getHealthAdapter();
			const status = await adapter.getPermissionStatus();
			if (status === 'not_determined') await adapter.requestReadPermission();
		}
	}

	function requireLegal(): boolean {
		if (legalAccepted || session?.user) return true;
		Alert.alert(tt('common.error'), tt('auth.legalConsentNeed'));
		return false;
	}

	async function saveGreetingNameField() {
		try {
			const changed = await persistGreetingName(greetingNameInput, session?.user ?? null);
			if (!changed) return;
			const fresh = await loadGreetingName(session?.user ?? null);
			setGreetingNameState(fresh);
			setGreetingNameInput(fresh);
			Alert.alert(tt('common.ok'), tt('auth.greetingNameSaved'));
		} catch {
			Alert.alert(tt('common.error'), tt('auth.greetingNameSaveFail'));
		}
	}

	async function copyProfileValue(value: string | null | undefined, kind: 'name' | 'email') {
		const text = value?.trim();
		if (!text) return;
		try {
			await Clipboard.setStringAsync(text);
			setCopiedHint(tt(kind === 'email' ? 'profile.copyEmail' : 'profile.copyName'));
		} catch {
			setCopiedHint(tt('profile.copyFail'));
		}
		if (copiedTimer.current) clearTimeout(copiedTimer.current);
		copiedTimer.current = setTimeout(() => setCopiedHint(null), 1800);
	}

	async function pickAvatar() {
		if (!session?.user || avatarBusy) return;
		const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!perm.granted) return;
		const picked = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ['images'],
			quality: 0.92
		});
		if (picked.canceled || !picked.assets[0]?.uri) return;
		setAvatarBusy(true);
		try {
			const prev = userCustomAvatarPath(session.user);
			await uploadAvatarMultipart(
				session.user.id,
				picked.assets[0].uri,
				picked.assets[0].mimeType ?? 'image/jpeg',
				'jpg',
				prev
			);
			const sb = getSupabase();
			const { data } = await sb!.auth.getUser();
			if (data.user) setSession({ ...session, user: data.user });
			Alert.alert(tt('common.ok'), tt('auth.avatar.saved'));
		} catch {
			Alert.alert(tt('common.error'), tt('auth.avatar.uploadFail'));
		} finally {
			setAvatarBusy(false);
		}
	}

	async function clearAvatar() {
		if (!session?.user || avatarBusy) return;
		const path = userCustomAvatarPath(session.user);
		setAvatarBusy(true);
		try {
			await removeAvatarRemote(path);
			const sb = getSupabase();
			const { data } = await sb!.auth.getUser();
			if (data.user) setSession({ ...session, user: data.user });
			Alert.alert(tt('common.ok'), tt('auth.avatar.removed'));
		} catch {
			Alert.alert(tt('common.error'), tt('auth.avatar.removeFail'));
		} finally {
			setAvatarBusy(false);
		}
	}

	async function exportBackup() {
		const [plans, sessions, records, customs] = await Promise.all([
			plansRepo.list(),
			sessionsRepo.list(),
			recordsRepo.list(),
			customsRepo.list()
		]);
		const json = exportPayloadToJson(buildExportPayload(plans, sessions, records, undefined, customs));
		const path = `${FileSystem.cacheDirectory}repdraft-backup.json`;
		await FileSystem.writeAsStringAsync(path, json);
		if (await Sharing.isAvailableAsync()) {
			await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: tt('profile.export') });
		} else {
			await Clipboard.setStringAsync(json);
			Alert.alert(tt('common.ok'), tt('profile.copied'));
		}
	}

	async function importBackup() {
		const picked = await DocumentPicker.getDocumentAsync({
			type: ['application/json', 'text/csv', 'text/comma-separated-values', 'text/plain'],
			copyToCacheDirectory: true
		});
		if (picked.canceled || !picked.assets?.[0]?.uri) return;

		setBusy(true);
		let result: ReturnType<typeof parseImportText> | null = null;
		let rawText = '';
		try {
			rawText = await FileSystem.readAsStringAsync(picked.assets[0].uri);
			result = parseImportText(rawText, loadExerciseIndex());
		} catch (err) {
			Alert.alert(
				tt('common.error'),
				err instanceof Error ? err.message : tt('common.error')
			);
			return;
		} finally {
			setBusy(false);
		}
		if (!result) return;
		if (!result.ok) {
			Alert.alert(
				tt('common.error'),
				result.reason === 'csvEmpty' ? tt('settings.importCsvEmpty') : result.reason
			);
			return;
		}

		const parsed = result;
		const run = async () => {
			setBusy(true);
			try {
				const stats = await applyBackupImport(parsed.payload);
				Alert.alert(
					tt('common.ok'),
					tt('profile.importOk', {
						plans: stats.plans,
						sessions: stats.sessions,
						records: stats.records,
						customs: stats.customs
					})
				);
			} catch (err) {
				Alert.alert(
					tt('common.error'),
					err instanceof Error ? err.message : tt('common.error')
				);
			} finally {
				setBusy(false);
			}
		};

		const isCsv = parsed.kind === 'csv';
		if (isCsv && parsed.report.customExercises.length > 0) {
			/* Parity with web: let the user map unknown names before applying. */
			setImportReview({
				raw: rawText,
				names: [...parsed.report.customExercises],
				overrides: {}
			});
			return;
		}

		const message = isCsv
			? `${tt('settings.importCsvPreview', {
					sessions: parsed.report.sessions,
					sets: parsed.report.sets,
					from: parsed.report.dateRange?.from.slice(0, 10) ?? '-',
					to: parsed.report.dateRange?.to.slice(0, 10) ?? '-',
					matched: parsed.report.matchedExercises,
					custom: parsed.report.customExercises.length,
					skipped: parsed.report.skippedRows
				})}\n\n${tt('settings.importCsvKg')}`
			: tt('settings.importConfirm');

		Alert.alert(isCsv ? tt('settings.importCsvTitle') : tt('settings.importConfirmTitle'), message, [
			{ text: tt('auth.deleteCancel'), style: 'cancel' },
			{ text: tt('settings.importConfirmCta'), onPress: () => void run() }
		]);
	}

	function setReviewOverride(key: string, value: string) {
		setImportReview((prev) =>
			prev ? { ...prev, overrides: { ...prev.overrides, [key]: value } } : prev
		);
	}

	async function commitReview() {
		const review = importReview;
		if (!review) return;
		const parsed = parseCsvImport(review.raw, {
			catalog: loadExerciseIndex(),
			overrides: review.overrides
		});
		if (!parsed.ok) {
			Alert.alert(tt('common.error'), tt('settings.importCsvEmpty'));
			return;
		}
		setImportReview(null);
		setBusy(true);
		try {
			const stats = await applyBackupImport(parsed.payload);
			Alert.alert(
				tt('common.ok'),
				tt('profile.importOk', {
					plans: stats.plans,
					sessions: stats.sessions,
					records: stats.records,
					customs: stats.customs
				})
			);
		} catch (err) {
			Alert.alert(tt('common.error'), err instanceof Error ? err.message : tt('common.error'));
		} finally {
			setBusy(false);
		}
	}

	async function syncCloud() {		setBusy(true);
		const result = await pullAndMergeFromCloud();
		setPendingSync(await outboxCount());
		setBusy(false);
		Alert.alert(
			result.ok ? tt('common.ok') : tt('common.error'),
			result.ok ? tt('profile.syncOk', { detail: result.message }) : result.message
		);
	}

	async function signIn() {
		if (!requireLegal()) return;
		const sb = getSupabase();
		if (!sb) return;
		setBusy(true);
		const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
		setBusy(false);
		if (error) {
			showAuthError(error, error.message);
			return;
		}
		const pulled = await pullAndMergeFromCloud();
		setPendingSync(await outboxCount());
		if (pulled.ok) {
			Alert.alert(tt('common.ok'), tt('profile.syncOk', { detail: pulled.message }));
		}
	}

	async function signUp() {
		if (!requireLegal()) return;
		const sb = getSupabase();
		if (!sb) return;
		const policyReason = validatePasswordPolicy(password, email.trim());
		if (policyReason !== 'ok') {
			Alert.alert(tt('common.error'), tt(passwordPolicyMessageKey(policyReason)));
			return;
		}
		setBusy(true);
		const { error } = await sb.auth.signUp({
			email: email.trim(),
			password,
			options: { emailRedirectTo: authEmailRedirect() }
		});
		setBusy(false);
		if (error) {
			showAuthError(error, error.message);
			return;
		}
		Alert.alert(tt('common.ok'), tt('profile.signUpOk'));
	}

	async function magicLink() {
		if (!requireLegal()) return;
		const sb = getSupabase();
		if (!sb) return;
		setBusy(true);
		const { error } = await sb.auth.signInWithOtp({
			email: email.trim(),
			options: { emailRedirectTo: authEmailRedirect(), shouldCreateUser: true }
		});
		setBusy(false);
		if (error) {
			showAuthError(error, error.message);
			return;
		}
		Alert.alert(
			tt('auth.checkEmailTitle'),
			tt('auth.checkEmailMagic', { email: email.trim() })
		);
	}

	async function resetPassword() {
		const sb = getSupabase();
		if (!sb) return;
		const trimmed = email.trim();
		if (!trimmed) {
			Alert.alert(tt('common.error'), tt('profile.email'));
			return;
		}
		setBusy(true);
		const { error } = await sb.auth.resetPasswordForEmail(trimmed, {
			redirectTo: authEmailRedirect()
		});
		setBusy(false);
		if (error) {
			showAuthError(error, error.message);
			return;
		}
		Alert.alert(tt('auth.checkEmailTitle'), tt('auth.checkEmailReset', { email: trimmed }), [
			{ text: tt('common.ok') }
		]);
	}

	function onVersionPress() {
		if (!testerOn) {
			if (versionUnlockTimer.current) clearTimeout(versionUnlockTimer.current);
			versionUnlockTaps.current += 1;
			if (versionUnlockTaps.current >= TESTER_MODE_UNLOCK_TAPS) {
				versionUnlockTaps.current = 0;
				void setTesterModeEnabled(true).then(() => {
					setTesterOn(true);
					Alert.alert(tt('common.ok'), tt('settings.testerModeOn'));
				});
			} else {
				versionUnlockTimer.current = setTimeout(() => {
					versionUnlockTaps.current = 0;
					versionUnlockTimer.current = null;
				}, 1600);
			}
		}
		setWhatsNewOpen(true);
	}

	async function confirmDevWipe() {
		Alert.alert(tt('settings.devWipeConfirmTitle'), tt('settings.devWipeConfirmHint'), [
			{ text: tt('settings.devWipeCancel'), style: 'cancel' },
			{
				text: tt('settings.devWipeButton'),
				style: 'destructive',
				onPress: () => {
					void (async () => {
						setBusy(true);
						try {
							const sb = getSupabase();
							if (sb) {
								try {
									await sb.auth.signOut({ scope: 'local' });
								} catch {
									/* offline ok */
								}
							}
							await wipeMobileAppStorage();
							setSession(null);
							router.replace('/');
						} catch {
							Alert.alert(tt('common.error'), tt('settings.devWipeFail'));
						} finally {
							setBusy(false);
						}
					})();
				}
			}
		]);
	}

	async function signOut() {
		const sb = getSupabase();
		if (!sb) return;
		await sb.auth.signOut();
	}

	function openSignOutConfirm() {
		if (busy) return;
		setLogoutOpen(true);
	}

	function openLogoutEverywhereConfirm() {
		setLogoutEverywhereOpen(true);
	}

	async function logoutEverywhere() {
		setLogoutEverywhereOpen(false);
		try {
			await signOutEverywhere();
			Alert.alert(tt('common.ok'), tt('auth.logoutEverywhereDone'));
		} catch (err) {
			Alert.alert(tt('common.error'), err instanceof Error ? err.message : tt('common.error'));
		}
	}

	async function confirmDeleteAccount() {
		if (deleteWord.trim() !== tt('auth.deleteConfirmWord')) return;
		setBusy(true);
		try {
			await deleteCloudAccount();
			setDeleteOpen(false);
			setDeleteWord('');
			Alert.alert(tt('common.ok'), tt('auth.deleteDone'));
		} catch (err) {
			Alert.alert(tt('common.error'), err instanceof Error ? err.message : tt('auth.deleteFail'));
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: tabPad + space.lg }]}
		>
			<View style={styles.brandRow}>
				<Pressable
					accessibilityRole="button"
					onPress={() => {
						if (session?.user && !avatarBusy) setAvatarSheetOpen(true);
					}}
					style={styles.avatarBtn}
				>
					{avatarUrl ? (
						<Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
					) : (
						<View style={[styles.avatarImg, styles.avatarFallback]}>
							<UserRound size={28} color={colors.text} strokeWidth={2} />
						</View>
					)}
				</Pressable>
				<View style={styles.brandBody}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={tt('profile.copyNameAria')}
						hitSlop={8}
						onPress={() => void copyProfileValue(displayName, 'name')}
					>
						<Text style={styles.brandTitle}>{displayName ?? 'Repdraft'}</Text>
					</Pressable>
					{session?.user?.email ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={tt('profile.copyEmailAria')}
							hitSlop={8}
							onPress={() => void copyProfileValue(session.user.email, 'email')}
						>
							<Text style={styles.brandHint} numberOfLines={1}>
								{session.user.email}
							</Text>
						</Pressable>
					) : (
						<Text style={styles.brandHint}>{tt('auth.greetingNameHint')}</Text>
					)}
					{copiedHint ? <Text style={styles.copiedHint}>{copiedHint}</Text> : null}
				</View>
			</View>
			{session?.user ? (
				<ProfileAvatarSheet
					open={avatarSheetOpen}
					canRemove={Boolean(userCustomAvatarPath(session.user))}
					busy={avatarBusy}
					onChangePhoto={() => void pickAvatar()}
					onRemovePhoto={() => void clearAvatar()}
					onDismiss={() => setAvatarSheetOpen(false)}
				/>
			) : null}

			{!session?.user ? (
				<Panel>
					<Text style={styles.groupTitle}>{tt('settings.accountTitle')}</Text>
					{!cloud ? (
						<Text style={styles.hint}>{tt('profile.cloudOff')}</Text>
					) : (
						<>
							<Pressable
								style={styles.legalRow}
								onPress={() => setLegalAccepted((v) => !v)}
								accessibilityRole="checkbox"
								accessibilityState={{ checked: legalAccepted }}
							>
								<Text style={styles.legalMark}>{legalAccepted ? '☑' : '☐'}</Text>
								<Text style={styles.legalText}>
									{tt('auth.legalConsentLead')}{' '}
									<Text
										style={styles.legalLink}
										onPress={() => void WebBrowser.openBrowserAsync(`${webOrigin()}/terms`)}
									>
										{tt('auth.legalTerms')}
									</Text>{' '}
									{tt('auth.legalConsentJoin')}{' '}
									<Text
										style={styles.legalLink}
										onPress={() => void WebBrowser.openBrowserAsync(`${webOrigin()}/privacy`)}
									>
										{tt('auth.legalPrivacy')}
									</Text>
								</Text>
							</Pressable>
							<View style={styles.authTabs}>
								<Pressable
									style={[styles.authTab, authMode === 'signin' && styles.authTabOn]}
									onPress={() => setAuthMode('signin')}
									accessibilityRole="tab"
									accessibilityState={{ selected: authMode === 'signin' }}
								>
									<Text style={[styles.authTabText, authMode === 'signin' && styles.authTabTextOn]}>
										{tt('profile.signIn')}
									</Text>
								</Pressable>
								<Pressable
									style={[styles.authTab, authMode === 'signup' && styles.authTabOn]}
									onPress={() => setAuthMode('signup')}
									accessibilityRole="tab"
									accessibilityState={{ selected: authMode === 'signup' }}
								>
									<Text style={[styles.authTabText, authMode === 'signup' && styles.authTabTextOn]}>
										{tt('profile.signUp')}
									</Text>
								</Pressable>
							</View>
							<TextInput
								style={styles.input}
								autoCapitalize="none"
								keyboardType="email-address"
								placeholder={tt('profile.email')}
								placeholderTextColor={colors.muted}
								value={email}
								onChangeText={setEmail}
							/>
							<TextInput
								style={styles.input}
								secureTextEntry
								placeholder={tt('profile.password')}
								placeholderTextColor={colors.muted}
								value={password}
								onChangeText={setPassword}
							/>
							{authMode === 'signin' ? (
								<>
									<PrimaryButton
										label={tt('profile.resetPassword')}
										variant="link"
										onPress={() => void resetPassword()}
										disabled={busy || !email.trim()}
									/>
									<PrimaryButton
										label={busy ? '…' : tt('profile.signIn')}
										onPress={() => void signIn()}
										disabled={busy}
									/>
									<PrimaryButton
										label={tt('profile.magicLink')}
										variant="link"
										onPress={() => void magicLink()}
										disabled={busy || !email.trim()}
									/>
								</>
							) : (
								<PrimaryButton
									label={busy ? '…' : tt('profile.signUp')}
									onPress={() => void signUp()}
									disabled={busy}
								/>
							)}
						</>
					)}
				</Panel>
			) : null}

			<Panel>
				<Text style={styles.groupTitle}>{tt('auth.greetingNameLabel')}</Text>
				<TextInput
					style={styles.input}
					placeholder={tt('auth.greetingNameLabel')}
					placeholderTextColor={colors.muted}
					value={greetingNameInput}
					maxLength={24}
					returnKeyType="done"
					onChangeText={(v) => setGreetingNameInput(clampGreetingName(v))}
					onEndEditing={() => void saveGreetingNameField()}
				/>
				<Text style={styles.hint}>{tt('auth.greetingNameHint')}</Text>
				<PrimaryButton
					label={tt('common.ok')}
					variant={greetingNameInput.trim() !== greetingName ? 'primary' : 'ghost'}
					onPress={() => void saveGreetingNameField()}
					disabled={greetingNameInput.trim() === greetingName}
				/>
			</Panel>

			{session?.user && cloud ? (
				<Panel>
					<Text style={styles.groupTitle}>{tt('profile.clients')}</Text>
					{assignment ? (
						<AssignedPlanCard
							assignment={assignment}
							busy={assignmentBusy}
							onImport={() => void importCoachAssignment()}
							onDismiss={() => void dismissCoachAssignment()}
						/>
					) : null}
					<Pressable
						style={styles.row}
						accessibilityRole="button"
						accessibilityLabel={`${tt('profile.myCoach')}, ${coachRowValue}`}
						onPress={() => setCoachSheetOpen(true)}
					>
						<View style={styles.coachRowBody}>
							<Text style={styles.coachRowLabel}>{tt('profile.myCoach')}</Text>
							<Text style={styles.coachRowValue} numberOfLines={1}>
								{coachRowValue}
							</Text>
						</View>
						<Text style={styles.rowValue}>→</Text>
					</Pressable>
					<Pressable
						style={styles.row}
						accessibilityRole="button"
						onPress={() => router.push('/clients')}
					>
						<Text style={styles.rowText}>{tt('profile.clientsRow')}</Text>
						<Text style={styles.rowValue}>→</Text>
					</Pressable>
				</Panel>
			) : null}

			<Panel>
				<Text style={styles.groupTitle}>{tt('progress.sectionTitle')}</Text>
				<Pressable style={styles.row} onPress={() => router.push('/progress')}>
					<Text style={styles.rowText}>{tt('nav.progress')}</Text>
					<Text style={styles.rowValue}>→</Text>
				</Pressable>
				<Pressable
					style={styles.row}
					accessibilityRole="button"
					accessibilityHint={coachBadge ? tt('coach.newHints') : undefined}
					onPress={() => router.push('/coach')}
				>
					<View style={styles.rowBadgeWrap}>
						<Text style={styles.rowText}>{tt('nav.coach')}</Text>
						{coachBadge ? <View style={styles.rowBadge} /> : null}
					</View>
					<Text style={styles.rowValue}>→</Text>
				</Pressable>
			</Panel>

			<Panel>
				<Text style={styles.groupTitle}>{tt('settings.interfaceTitle')}</Text>
				<Pressable style={styles.row} onPress={() => setLocale(locale === 'ru' ? 'en' : 'ru')}>
					<Text style={styles.rowText}>{tt('profile.locale')}</Text>
					<Text style={styles.rowValue}>{locale === 'ru' ? 'RU' : 'EN'}</Text>
				</Pressable>
				<Pressable style={styles.row} onPress={cycleMode}>
					<Text style={styles.rowText}>{tt('settings.theme')}</Text>
					<Text style={styles.rowValue}>
						{mode === 'dark' ? tt('settings.themeDark') : tt('settings.themeLight')}
					</Text>
				</Pressable>
			</Panel>

			<Panel>
				<Text style={styles.groupTitle}>{tt('settings.sessionTitle')}</Text>
				<View style={styles.row}>
					<Text style={styles.rowText} numberOfLines={2}>
						{tt('profile.restSound')}
					</Text>
					<Switch
						value={restSound}
						trackColor={switchColors.trackColor}
						thumbColor={switchColors.thumbColor}
						onValueChange={(v) => {
							setRestSound(v);
							void setRestSoundEnabled(v);
							if (v) {
								unlockRestAudioFromGesture();
								void playRestDoneChime();
							}
						}}
					/>
				</View>
				<View style={styles.row}>
					<Text style={styles.rowText} numberOfLines={2}>
						{tt('profile.hapticRest')}
					</Text>
					<Switch
						value={hapticRest}
						trackColor={switchColors.trackColor}
						thumbColor={switchColors.thumbColor}
						onValueChange={(v) => {
							setHapticRest(v);
							void setHapticRestEnabled(v);
						}}
					/>
				</View>
				<Text style={styles.hint}>{tt('settings.restSoundHint')}</Text>
			</Panel>

			<Panel>
				<Text style={styles.groupTitle}>{tt('health.title')}</Text>
				<View style={styles.row}>
					<Text style={styles.rowText} numberOfLines={2}>
						{tt('health.toggle')}
					</Text>
					<Switch
						value={healthOn}
						trackColor={switchColors.trackColor}
						thumbColor={switchColors.thumbColor}
						onValueChange={(v) => void toggleHealth(v)}
					/>
				</View>
				<Text style={styles.hint}>
					{healthAvailable ? tt('health.hint') : tt('health.needDevBuild')}
				</Text>
			</Panel>

			{testerOn && loopSnap ? (
				<Panel>
					<Text style={styles.groupTitle}>{tt('loopMetrics.title')}</Text>
					<Text style={styles.hint}>{tt('loopMetrics.hint')}</Text>
					<Text style={styles.metricLine}>
						{tt('loopMetrics.started')}: {loopSnap.sessionStarted}
					</Text>
					<Text style={styles.metricLine}>
						{tt('loopMetrics.finished')}: {loopSnap.sessionFinished}
					</Text>
					<Text style={styles.metricLine}>
						{tt('loopMetrics.completion')}: {formatRatePercent(loopSnap.completionRate)}
					</Text>
					<Text style={styles.metricLine}>
						{tt('loopMetrics.activation')}: {boolLabel(tt, loopSnap.activatedWithin7d)}
					</Text>
					<Text style={styles.metricLine}>
						{tt('loopMetrics.week4')}: {boolLabel(tt, loopSnap.week4Retained)}
					</Text>
				</Panel>
			) : null}

			<Panel>
				<Text style={styles.groupTitle}>{tt('settings.exportTitle')}</Text>
				<Text style={styles.hint}>{tt('profile.backupHint')}</Text>
				<PrimaryButton label={tt('profile.export')} onPress={() => void exportBackup()} />
				<PrimaryButton
					label={tt('profile.import')}
					variant="ghost"
					onPress={() => void importBackup()}
					disabled={busy}
				/>
			</Panel>

			{session?.user ? (
				<Panel>
					<Text style={styles.groupTitle}>{tt('settings.accountTitle')}</Text>
					{pendingSync > 0 ? (
						<Text style={styles.hint}>{tt('profile.outbox', { n: pendingSync })}</Text>
					) : null}
					<PrimaryButton
						label={busy ? '…' : tt('profile.sync')}
						onPress={() => void syncCloud()}
						disabled={busy}
					/>
					<PrimaryButton
						label={tt('profile.signOut')}
						variant="ghost"
						onPress={openSignOutConfirm}
					/>
					<Text style={[styles.hint, styles.accountHint]}>{tt('auth.logoutEverywhereHint')}</Text>
					<PrimaryButton
						label={tt('auth.logoutEverywhere')}
						variant="ghost"
						onPress={() => openLogoutEverywhereConfirm()}
					/>
				</Panel>
			) : null}

			{session?.user ? (
				<Panel>
					<Pressable
						accessibilityRole="button"
						accessibilityState={{ expanded: deleteZoneOpen }}
						onPress={() => {
							if (deleteZoneOpen) {
								setDeleteOpen(false);
								setDeleteWord('');
							}
							setDeleteZoneOpen(!deleteZoneOpen);
						}}
						style={styles.dangerHeader}
					>
						<View style={styles.dangerHeaderText}>
							<Text style={styles.groupTitle}>{tt('auth.deleteZoneLabel')}</Text>
							<Text style={styles.dangerTitle}>{tt('auth.deleteTitle')}</Text>
						</View>
						<View style={[styles.dangerChevron, deleteZoneOpen && styles.dangerChevronOpen]}>
							<ChevronDown color={colors.danger} size={18} strokeWidth={2.25} />
						</View>
					</Pressable>
					{deleteZoneOpen ? (
						<>
							<Text style={styles.hint}>{tt('auth.deleteLead')}</Text>
							<Text style={styles.metricLine}>• {tt('auth.deleteBulletPlans')}</Text>
							<Text style={styles.metricLine}>• {tt('auth.deleteBulletRecords')}</Text>
							<Text style={styles.metricLine}>• {tt('auth.deleteBulletSessions')}</Text>
							{!deleteOpen ? (
								<PrimaryButton
									label={tt('auth.deleteButton')}
									variant="danger"
									onPress={() => setDeleteOpen(true)}
								/>
							) : (
								<>
									<Text style={styles.hint}>
										{tt('auth.deleteConfirmHint', {
											word: tt('auth.deleteConfirmWord')
										})}
									</Text>
									<TextInput
										style={styles.input}
										value={deleteWord}
										onChangeText={setDeleteWord}
										autoCapitalize="characters"
										placeholder={tt('auth.deleteConfirmWord')}
										placeholderTextColor={colors.muted}
									/>
									<PrimaryButton
										label={tt('auth.deleteButtonFinal')}
										variant="danger"
										disabled={busy || deleteWord.trim() !== tt('auth.deleteConfirmWord')}
										onPress={() => void confirmDeleteAccount()}
									/>
									<PrimaryButton
										label={tt('auth.deleteCancel')}
										variant="ghost"
										onPress={() => {
											setDeleteOpen(false);
											setDeleteWord('');
										}}
									/>
								</>
							)}
						</>
					) : null}
				</Panel>
			) : null}

			{onboarding ? (
				<Panel>
					<Text style={styles.groupTitle}>{tt('onboarding.authHelp')}</Text>
					<Text style={styles.hint}>{tt('onboarding.authHelpLead')}</Text>
					<PrimaryButton
						label={tt('articles.viewAll')}
						variant="ghost"
						onPress={() => router.push('/articles')}
					/>
					{!onboardingComplete ? <OnboardingChecklistPanel state={onboarding} readonly /> : null}
				</Panel>
			) : null}

			{testerOn ? (
				<Panel>
					<Text style={styles.groupTitle}>{tt('settings.devWipeTitle')}</Text>
					<Text style={styles.hint}>{tt('settings.devWipeLead')}</Text>
					<PrimaryButton
						label={tt('settings.devWipeButton')}
						variant="ghost"
						onPress={() => void confirmDevWipe()}
						disabled={busy}
					/>
					<PrimaryButton
						label={tt('settings.testerModeOff')}
						variant="ghost"
						onPress={() =>
							void setTesterModeEnabled(false).then(() => setTesterOn(false))
						}
					/>
				</Panel>
			) : null}

			<Pressable accessibilityRole="button" onPress={onVersionPress}>
				<Text style={styles.version}>{tt('profile.version', { v: APP_VERSION })}</Text>
			</Pressable>
		</ScrollView>
		<Modal
			visible={importReview !== null}
			transparent
			animationType="slide"
			onRequestClose={() => setImportReview(null)}
		>
			<View style={styles.reviewBackdrop}>
				<View style={styles.reviewSheet}>
					<Text style={styles.groupTitle}>{tt('settings.importCsvTitle')}</Text>
					<Text style={styles.hint}>
						{tt('settings.importCsvReview', { n: importReview?.names.length ?? 0 })}
					</Text>
					<ScrollView style={styles.reviewList}>
						{importReview?.names.map((name) => {
							const key = normalizeExerciseName(name);
							const value = importReview.overrides[key] ?? '';
							const candidates = suggestCatalogCandidates(name, loadExerciseIndex(), 3);
							return (
								<View key={key} style={styles.reviewRow}>
									<Text style={styles.rowText}>{name}</Text>
									<View style={styles.reviewChips}>
										<Pressable
											accessibilityRole="button"
											style={[styles.reviewChip, value === '' && styles.reviewChipActive]}
											onPress={() => setReviewOverride(key, '')}
										>
											<Text style={styles.reviewChipText}>
												{tt('settings.importCsvKeepNew')}
											</Text>
										</Pressable>
										{candidates.map((candidate) => (
											<Pressable
												key={candidate.id}
												accessibilityRole="button"
												style={[
													styles.reviewChip,
													value === candidate.id && styles.reviewChipActive
												]}
												onPress={() => setReviewOverride(key, candidate.id)}
											>
												<Text style={styles.reviewChipText}>{candidate.name}</Text>
											</Pressable>
										))}
									</View>
								</View>
							);
						})}
					</ScrollView>
					<View style={styles.reviewActions}>
						<PrimaryButton
							label={tt('common.cancel')}
							variant="ghost"
							onPress={() => setImportReview(null)}
						/>
						<PrimaryButton
							label={tt('settings.importConfirmCta')}
							onPress={() => void commitReview()}
							disabled={busy}
						/>
					</View>
				</View>
			</View>
		</Modal>
		<BottomSheet
			open={coachSheetOpen}
			onDismiss={() => setCoachSheetOpen(false)}
			label={tt('profile.myCoach')}
			raised={myCoaches.length === 0}
			dismissible={!coachInviteBusy}
		>
			<Text style={styles.sheetTitle}>{tt('profile.myCoach')}</Text>
			{!coachesLoaded ? (
				<Text style={styles.hint}>…</Text>
			) : myCoaches.length > 0 ? (
				myCoaches.map((coach) => (
					<View key={coach.linkId} style={styles.coachBlock}>
						<Text style={styles.sheetRowTitle}>{coachDisplayName(coach)}</Text>
						<Text style={styles.hint}>
							{tt('coach.connectedOn', {
								when: formatRelativeDay(coach.createdAt, locale)
							})}
						</Text>
						<Text style={styles.hint}>{tt('profile.coachConnectedHint')}</Text>
						<PrimaryButton
							label={tt('coach.disconnect')}
							variant="danger"
							compact
							onPress={() => {
								setCoachSheetOpen(false);
								setDisconnectTarget(coach);
							}}
						/>
					</View>
				))
			) : (
				<>
					<Text style={styles.hint}>{tt('coach.inviteAcceptLead')}</Text>
					<TextInput
						style={[styles.input, styles.inviteInput]}
						placeholder={tt('coach.inviteAcceptPlaceholder')}
						placeholderTextColor={colors.muted}
						accessibilityLabel={tt('coach.inviteAcceptLabel')}
						autoCapitalize="characters"
						autoCorrect={false}
						maxLength={INVITE_CODE_LENGTH + 1}
						value={coachInviteInput}
						onChangeText={onCoachInviteChange}
					/>
					<PrimaryButton
						label={coachInviteBusy ? '…' : tt('coach.inviteAcceptCta')}
						onPress={() => void acceptCoachInvite()}
						disabled={coachInviteBusy || normalizeInviteCode(coachInviteInput).length === 0}
					/>
				</>
			)}
		</BottomSheet>
		<ConfirmSheet
			open={disconnectTarget !== null}
			title={tt('coach.disconnectConfirmTitle')}
			message={tt('coach.disconnectConfirmLead', {
				name: disconnectTarget ? coachDisplayName(disconnectTarget) : ''
			})}
			onDismiss={() => setDisconnectTarget(null)}
			actions={[
				{
					label: tt('coach.disconnect'),
					variant: 'danger',
					onPress: () => {
						const target = disconnectTarget;
						if (target) void disconnectCoach(target);
					}
				}
			]}
		/>
		<ConfirmSheet
			open={logoutOpen}
			title={tt('auth.logoutConfirmTitle')}
			message={tt('auth.logoutConfirmLead')}
			onDismiss={() => setLogoutOpen(false)}
			actions={[
				{
					label: tt('profile.signOut'),
					onPress: () => void signOut()
				}
			]}
		/>
		<ConfirmSheet
			open={logoutEverywhereOpen}
			title={tt('auth.logoutEverywhereConfirmTitle')}
			message={tt('auth.logoutEverywhereConfirmLead')}
			onDismiss={() => setLogoutEverywhereOpen(false)}
			actions={[
				{
					label: tt('auth.logoutEverywhereConfirmAction'),
					variant: 'danger',
					onPress: () => void logoutEverywhere()
				}
			]}
		/>
		<WhatsNewSheet visible={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
		</>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
	scroll: { flex: 1, backgroundColor: colors.bg },
	root: { paddingHorizontal: space.page, paddingTop: space.lg, gap: space.md, backgroundColor: colors.bg },
	reviewBackdrop: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: colors.overlayScrim
	},
	reviewSheet: {
		backgroundColor: colors.bg,
		borderTopLeftRadius: radius.lg,
		borderTopRightRadius: radius.lg,
		padding: space.lg,
		gap: space.sm
	},
	reviewList: { maxHeight: 360 },
	reviewRow: { gap: 6, marginBottom: space.md },
	reviewChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
	reviewChip: {
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		paddingHorizontal: 10,
		paddingVertical: 8
	},
	reviewChipActive: { borderColor: colors.accent, backgroundColor: colors.panel },
	reviewChipText: { color: colors.text, fontSize: 13, fontFamily: fontFamily.medium },
	reviewActions: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
	brandRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
		paddingBottom: space.xs
	},
	avatarBtn: { minWidth: touchMin, minHeight: touchMin },
	avatarImg: {
		width: 52,
		height: 52,
		borderRadius: 26,
		backgroundColor: colors.panelRaised
	},
	avatarFallback: { alignItems: 'center', justifyContent: 'center' },
	brandBody: { flex: 1 },
	brandTitle: { ...type.title, color: colors.text },
	brandHint: { ...type.meta, color: colors.muted, marginTop: 2 },
	copiedHint: { color: colors.accent, fontSize: 12, marginTop: 2, fontFamily: fontFamily.medium },
	groupTitle: {
		...type.section,
		color: colors.muted,
		textTransform: 'uppercase',
		letterSpacing: 0.8,
		marginBottom: space.sm
	},
	hint: { color: colors.muted, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
	coachBlock: { gap: 4, marginBottom: space.sm },
	coachRowBody: { flex: 1, minWidth: 0 },
	coachRowLabel: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold },
	coachRowValue: { marginTop: 2, color: colors.muted, fontSize: 13, fontFamily: fontFamily.regular },
	sheetTitle: {
		color: colors.text,
		fontSize: 18,
		lineHeight: 24,
		fontFamily: fontFamily.semibold
	},
	sheetRowTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.semibold },
	inviteInput: {
		fontFamily: fontFamily.semibold,
		letterSpacing: 2,
		textAlign: 'center'
	},
	accountHint: { marginTop: 4, marginBottom: 2 },
	dangerHeader: {
		minHeight: touchMin,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: space.sm
	},
	dangerHeaderText: { flex: 1, minWidth: 0 },
	dangerTitle: { color: colors.text, fontSize: 16, lineHeight: 21, fontFamily: fontFamily.semibold },
	dangerChevron: { transform: [{ rotate: '0deg' }] },
	dangerChevronOpen: { transform: [{ rotate: '180deg' }] },
	metricLine: { color: colors.text, fontSize: 14, fontFamily: fontFamily.regular },
	version: {
		color: colors.muted,
		fontSize: 13,
		marginTop: space.lg,
		textAlign: 'center',
		fontFamily: fontFamily.regular
	},
	row: {
		minHeight: touchMin,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between'
	},
	rowText: {
		color: colors.text,
		fontWeight: '600',
		flex: 1,
		paddingRight: space.sm,
		fontFamily: fontFamily.semibold
	},
	rowValue: { color: colors.accent, fontWeight: '800', fontSize: 16, fontFamily: fontFamily.extrabold },
	rowBadgeWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
	rowBadge: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
	legalRow: { flexDirection: 'row', gap: space.sm, minHeight: touchMin, alignItems: 'flex-start' },
	legalMark: { color: colors.text, fontSize: 18, lineHeight: 22, fontFamily: fontFamily.bold },
	legalText: {
		flex: 1,
		color: colors.muted,
		fontSize: 13,
		lineHeight: 18,
		fontFamily: fontFamily.regular
	},
	legalLink: { color: colors.accent, fontWeight: '700', fontFamily: fontFamily.bold },
	authTabs: {
		flexDirection: 'row',
		backgroundColor: colors.panelRaised,
		borderRadius: radius.pill,
		padding: 4,
		gap: 4
	},
	authTab: {
		flex: 1,
		minHeight: touchMin,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: radius.pill
	},
	authTabOn: { backgroundColor: colors.panel },
	authTabText: { color: colors.muted, fontSize: 15, fontWeight: '600', fontFamily: fontFamily.semibold },
	authTabTextOn: { color: colors.text, fontFamily: fontFamily.bold },
	input: {
		minHeight: touchMin,
		borderRadius: radius.sm,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panelRaised,
		color: colors.text,
		paddingHorizontal: space.md,
		fontFamily: fontFamily.regular
	}
	});
}
