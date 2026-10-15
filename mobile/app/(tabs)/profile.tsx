import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import {
	Alert,
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	View
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { userCustomAvatarPath, userDisplayName, userInitials } from '@repdraft/domain/authFlow';
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
import { unlockRestAudioFromGesture, playRestDoneChime } from '../../src/audio/restChime';
import { webOrigin } from '../../src/catalog/mediaUrl';
import { getSupabase, isSupabaseConfigured } from '../../src/auth/supabase';
import { BrandMark } from '../../src/components/BrandMark';
import { Panel } from '../../src/components/Panel';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { WhatsNewSheet } from '../../src/components/WhatsNewSheet';
import { loadGreetingName, saveGreetingName as persistGreetingName } from '../../src/state/greetingName';
import { useLocale } from '../../src/state/locale';
import { useAppColors, useAppTheme } from '../../src/state/theme';
import {
	isQuestEnabled,
	loadQuestState,
	setQuestEnabled,
	setWeeklyGoal
} from '../../src/state/quest';
import { applyBackupImport, parseBackupText } from '../../src/storage/backup';
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
import { outboxCount, pullAndMergeFromCloud } from '../../src/sync/cloudSync';
import { radius, space, touchMin, type, type ColorPalette } from '../../src/theme';

const APP_VERSION =
	Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '0.21.0';

function boolLabel(tt: (k: string) => string, v: boolean | null): string {
	if (v == null) return '-';
	return tt(v ? 'loopMetrics.yes' : 'loopMetrics.no');
}

export default function ProfileScreen() {
	const { locale, setLocale, tt } = useLocale();
	const colors = useAppColors();
	const { mode, cycleMode } = useAppTheme();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const switchColors = useMemo(
		() => ({
			trackColor: { false: colors.border, true: colors.accent } as const,
			thumbColor: colors.text
		}),
		[colors]
	);
	const [questOn, setQuestOn] = useState(false);
	const [weeklyGoal, setWeeklyGoalUi] = useState(2);
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
	const [whatsNewOpen, setWhatsNewOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteWord, setDeleteWord] = useState('');
	const [avatarBusy, setAvatarBusy] = useState(false);
	const cloud = isSupabaseConfigured();
	const avatarUrl = session?.user ? resolveUserAvatarUrl(session.user) : null;
	const displayName = userDisplayName(session?.user ?? null);
	const initials = userInitials(session?.user ?? null);

	useFocusEffect(
		useCallback(() => {
			void sessionsRepo.list().then((list) => {
				setLoopSnap(computeLoopMetrics(list, new Date().toISOString()));
			});
			void outboxCount().then(setPendingSync);
		}, [])
	);

	useEffect(() => {
		let unsub: (() => void) | undefined;
		void (async () => {
			setQuestOn(await isQuestEnabled());
			const st = await loadQuestState();
			setWeeklyGoalUi(st.weeklyGoal);
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

	async function toggleQuest(next: boolean) {
		setQuestOn(next);
		await setQuestEnabled(next);
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

	async function cycleGoal() {
		const next = weeklyGoal >= 7 ? 1 : weeklyGoal + 1;
		setWeeklyGoalUi(next);
		await setWeeklyGoal(next);
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
			await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Repdraft backup' });
		} else {
			await Clipboard.setStringAsync(json);
			Alert.alert(tt('common.ok'), tt('profile.copied'));
		}
	}

	async function importBackup() {
		const picked = await DocumentPicker.getDocumentAsync({
			type: 'application/json',
			copyToCacheDirectory: true
		});
		if (picked.canceled || !picked.assets?.[0]?.uri) return;
		const run = async () => {
		setBusy(true);
		try {
			const raw = await FileSystem.readAsStringAsync(picked.assets[0].uri);
			const parsed = parseBackupText(raw);
			if (!parsed.ok) {
				Alert.alert(tt('common.error'), parsed.reason);
				return;
			}
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
		Alert.alert(tt('settings.importConfirmTitle'), tt('settings.importConfirm'), [
			{ text: tt('auth.deleteCancel'), style: 'cancel' },
			{ text: tt('settings.importConfirmCta'), onPress: () => void run() }
		]);
	}

	async function syncCloud() {
		setBusy(true);
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
			Alert.alert(tt('common.error'), error.message);
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
		setBusy(true);
		const { error } = await sb.auth.signUp({ email: email.trim(), password });
		setBusy(false);
		if (error) {
			Alert.alert(tt('common.error'), error.message);
			return;
		}
		Alert.alert(tt('common.ok'), tt('profile.signUpOk'));
	}

	async function magicLink() {
		if (!requireLegal()) return;
		const sb = getSupabase();
		if (!sb) return;
		setBusy(true);
		const { error } = await sb.auth.signInWithOtp({ email: email.trim() });
		setBusy(false);
		if (error) {
			Alert.alert(tt('common.error'), error.message);
			return;
		}
		Alert.alert(tt('common.ok'), tt('profile.magicOk'));
	}

	async function resetPassword() {
		const sb = getSupabase();
		if (!sb) return;
		setBusy(true);
		const { error } = await sb.auth.resetPasswordForEmail(email.trim());
		setBusy(false);
		if (error) {
			Alert.alert(tt('common.error'), error.message);
			return;
		}
		Alert.alert(tt('common.ok'), tt('profile.resetOk'));
	}

	async function signOut() {
		const sb = getSupabase();
		if (!sb) return;
		await sb.auth.signOut();
	}

	async function logoutEverywhere() {
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
		<ScrollView contentContainerStyle={styles.root}>
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
							<Text style={styles.avatarInitials}>{initials ?? '?'}</Text>
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
				<BrandMark size={40} />
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
				<Text style={styles.groupTitle}>{tt('profile.quest')}</Text>
				<View style={styles.row}>
					<Text style={styles.rowText} numberOfLines={2}>
						{tt('profile.quest')}
					</Text>
					<Switch
						value={questOn}
						trackColor={switchColors.trackColor}
						thumbColor={switchColors.thumbColor}
						onValueChange={(v) => void toggleQuest(v)}
					/>
				</View>
				<Text style={styles.hint}>{tt('profile.questHint')}</Text>
				{questOn ? (
					<Pressable style={styles.row} onPress={() => void cycleGoal()}>
						<Text style={styles.rowText}>{tt('profile.weeklyGoal')}</Text>
						<Text style={styles.rowValue}>{weeklyGoal}</Text>
					</Pressable>
				) : null}
			</Panel>

			{loopSnap ? (
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

			<Panel>
				<Text style={styles.groupTitle}>{tt('settings.accountTitle')}</Text>
				{!cloud ? (
					<Text style={styles.hint}>{tt('profile.cloudOff')}</Text>
				) : session?.user ? (
					<>
						{pendingSync > 0 ? (
							<Text style={styles.hint}>{tt('profile.outbox', { n: pendingSync })}</Text>
						) : null}
						<PrimaryButton
							label={busy ? '…' : tt('profile.sync')}
							onPress={() => void syncCloud()}
							disabled={busy}
						/>
						<PrimaryButton label={tt('profile.signOut')} variant="ghost" onPress={() => void signOut()} />
						<PrimaryButton
							label={tt('auth.logoutEverywhere')}
							variant="ghost"
							onPress={() => void logoutEverywhere()}
						/>
					</>
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
						<PrimaryButton
							label={busy ? '…' : tt('profile.signIn')}
							onPress={() => void signIn()}
							disabled={busy}
						/>
						<PrimaryButton
							label={tt('profile.signUp')}
							variant="ghost"
							onPress={() => void signUp()}
							disabled={busy}
						/>
						<PrimaryButton
							label={tt('profile.magicLink')}
							variant="ghost"
							onPress={() => void magicLink()}
							disabled={busy || !email.trim()}
						/>
						<PrimaryButton
							label={tt('profile.resetPassword')}
							variant="ghost"
							onPress={() => void resetPassword()}
							disabled={busy || !email.trim()}
						/>
					</>
				)}
			</Panel>

			{session?.user ? (
				<Panel>
					<Text style={styles.groupTitle}>{tt('auth.deleteZoneLabel')}</Text>
					<Text style={styles.hint}>{tt('auth.deleteTitle')}</Text>
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
								{tt('auth.deleteConfirmHint', { word: tt('auth.deleteConfirmWord') })}
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
				</Panel>
			) : null}

			<Pressable accessibilityRole="button" onPress={() => setWhatsNewOpen(true)}>
				<Text style={styles.version}>{tt('profile.version', { v: APP_VERSION })}</Text>
			</Pressable>
		</ScrollView>
		<WhatsNewSheet visible={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
		</>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
	root: { padding: space.lg, gap: space.md, backgroundColor: colors.bg, paddingBottom: 48 },
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
	avatarInitials: { color: colors.text, fontWeight: '800', fontSize: 18 },
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
	hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
	metricLine: { color: colors.text, fontSize: 14 },
	version: { color: colors.muted, fontSize: 13, marginTop: space.lg, textAlign: 'center' },
	row: {
		minHeight: touchMin,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between'
	},
	rowText: { color: colors.text, fontWeight: '600', flex: 1, paddingRight: space.sm },
	rowValue: { color: colors.accent, fontWeight: '800', fontSize: 16 },
	legalRow: { flexDirection: 'row', gap: space.sm, minHeight: touchMin, alignItems: 'flex-start' },
	legalMark: { color: colors.text, fontSize: 18, lineHeight: 22 },
	legalText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 18 },
	legalLink: { color: colors.accent, fontWeight: '700' },
	input: {
		minHeight: touchMin,
		borderRadius: radius.sm,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panelRaised,
		color: colors.text,
		paddingHorizontal: space.md
	}
	});
}
