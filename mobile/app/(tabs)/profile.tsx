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
import { clampGreetingName } from '@repdraft/domain/greetingName';
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
import { ConfirmSheet } from '../../src/components/ConfirmSheet';
import { OnboardingChecklistPanel } from '../../src/components/OnboardingChecklistPanel';
import { Panel } from '../../src/components/Panel';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { WhatsNewSheet } from '../../src/components/WhatsNewSheet';
import { getHealthAdapter } from '../../src/health';
import { loadGreetingName, saveGreetingName as persistGreetingName } from '../../src/state/greetingName';
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
			thumbColor: colors.accentText
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
	const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
	const [testerOn, setTesterOn] = useState(false);
	const versionUnlockTaps = useRef(0);
	const versionUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cloud = isSupabaseConfigured();
	const avatarUrl = session?.user ? resolveUserAvatarUrl(session.user) : null;
	const displayName = userDisplayName(session?.user ?? null);
	const onboardingProgress = onboarding ? checklistProgress(onboarding) : null;
	const onboardingComplete = Boolean(
		onboardingProgress && onboardingProgress.done >= onboardingProgress.total
	);

	useFocusEffect(
		useCallback(() => {
			void outboxCount().then(setPendingSync);
			void loadOnboarding().then(setOnboarding);
		}, [])
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
					onPress={() => session?.user && !avatarBusy && void pickAvatar()}
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
					<Text style={styles.brandTitle}>{displayName ?? 'Repdraft'}</Text>
				{session?.user?.email ? (
					<Text style={styles.brandHint} numberOfLines={1}>
						{session.user.email}
					</Text>
				) : (
					<Text style={styles.brandHint}>{tt('auth.greetingNameHint')}</Text>
				)}
			</View>
		</View>
			{session?.user ? (
				<Panel>
					<PrimaryButton label={tt('auth.avatar.change')} variant="ghost" onPress={() => void pickAvatar()} />
					{userCustomAvatarPath(session.user) ? (
						<PrimaryButton
							label={tt('auth.avatar.remove')}
							variant="ghost"
							onPress={() => void clearAvatar()}
						/>
					) : null}
				</Panel>
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

			<Panel>
				<Text style={styles.groupTitle}>{tt('progress.sectionTitle')}</Text>
				<Pressable style={styles.row} onPress={() => router.push('/progress')}>
					<Text style={styles.rowText}>{tt('nav.progress')}</Text>
					<Text style={styles.rowValue}>→</Text>
				</Pressable>
				<Pressable style={styles.row} onPress={() => router.push('/coach')}>
					<Text style={styles.rowText}>{tt('nav.coach')}</Text>
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
	root: { padding: space.lg, gap: space.md, backgroundColor: colors.bg },
	reviewBackdrop: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0,0,0,0.5)'
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
	groupTitle: {
		...type.section,
		color: colors.muted,
		textTransform: 'uppercase',
		letterSpacing: 0.8,
		marginBottom: space.sm
	},
	hint: { color: colors.muted, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
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
