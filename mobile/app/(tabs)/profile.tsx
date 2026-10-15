import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	View
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { buildExportPayload, exportPayloadToJson } from '@repdraft/domain/exportData';
import {
	computeLoopMetrics,
	formatRatePercent,
	type LoopMetricsSnapshot
} from '@repdraft/domain/loopMetrics';
import { getSupabase, isSupabaseConfigured } from '../../src/auth/supabase';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useLocale } from '../../src/state/locale';
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
import { outboxCount, pullAndMergeFromCloud } from '../../src/sync/cloudSync';
import { colors, touchMin } from '../../src/theme';

const APP_VERSION =
	Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '0.21.0';

function boolLabel(tt: (k: string) => string, v: boolean | null): string {
	if (v == null) return '-';
	return tt(v ? 'loopMetrics.yes' : 'loopMetrics.no');
}

export default function ProfileScreen() {
	const { locale, setLocale, tt } = useLocale();
	const [questOn, setQuestOn] = useState(false);
	const [weeklyGoal, setWeeklyGoalUi] = useState(2);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [session, setSession] = useState<Session | null>(null);
	const [busy, setBusy] = useState(false);
	const [loopSnap, setLoopSnap] = useState<LoopMetricsSnapshot | null>(null);
	const [pendingSync, setPendingSync] = useState(0);
	const cloud = isSupabaseConfigured();

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
			const sb = getSupabase();
			if (!sb) return;
			const { data } = await sb.auth.getSession();
			setSession(data.session);
			const { data: sub } = sb.auth.onAuthStateChange((_e, next) => setSession(next));
			unsub = () => sub.subscription.unsubscribe();
		})();
		return () => unsub?.();
	}, []);

	async function toggleQuest(next: boolean) {
		setQuestOn(next);
		await setQuestEnabled(next);
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

	async function signOut() {
		const sb = getSupabase();
		if (!sb) return;
		await sb.auth.signOut();
	}

	return (
		<ScrollView contentContainerStyle={styles.root}>
			<Text style={styles.section}>{tt('profile.locale')}</Text>
			<Pressable
				style={styles.row}
				onPress={() => setLocale(locale === 'ru' ? 'en' : 'ru')}
			>
				<Text style={styles.rowText}>
					{locale === 'ru' ? 'Русский -> English' : 'English -> Русский'}
				</Text>
			</Pressable>

			<Text style={styles.section}>{tt('profile.quest')}</Text>
			<View style={styles.row}>
				<Text style={styles.rowText}>{tt('profile.quest')}</Text>
				<Switch value={questOn} onValueChange={(v) => void toggleQuest(v)} />
			</View>
			<Text style={styles.hint}>{tt('profile.questHint')}</Text>
			{questOn ? (
				<Pressable style={styles.row} onPress={() => void cycleGoal()}>
					<Text style={styles.rowText}>
						{tt('profile.weeklyGoal')}: {weeklyGoal}
					</Text>
				</Pressable>
			) : null}

			{loopSnap ? (
				<>
					<Text style={styles.section}>{tt('loopMetrics.title')}</Text>
					<Text style={styles.hint}>{tt('loopMetrics.hint')}</Text>
					<View style={styles.metrics}>
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
					</View>
				</>
			) : null}

			<Text style={styles.section}>{tt('profile.export')}</Text>
			<Text style={styles.hint}>{tt('profile.backupHint')}</Text>
			<PrimaryButton label={tt('profile.export')} onPress={() => void exportBackup()} />
			<PrimaryButton
				label={tt('profile.import')}
				variant="ghost"
				onPress={() => void importBackup()}
				disabled={busy}
			/>

			<Text style={styles.section}>{tt('profile.signIn')}</Text>
			{!cloud ? (
				<Text style={styles.hint}>{tt('profile.cloudOff')}</Text>
			) : session?.user ? (
				<>
					<Text style={styles.hint}>{session.user.email}</Text>
					{pendingSync > 0 ? (
						<Text style={styles.hint}>{tt('profile.outbox', { n: pendingSync })}</Text>
					) : null}
					<PrimaryButton
						label={busy ? '…' : tt('profile.sync')}
						onPress={() => void syncCloud()}
						disabled={busy}
					/>
					<PrimaryButton label={tt('profile.signOut')} variant="ghost" onPress={() => void signOut()} />
				</>
			) : (
				<>
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
				</>
			)}

			<Text style={styles.version}>{tt('profile.version', { v: APP_VERSION })}</Text>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	root: { padding: 16, gap: 10, backgroundColor: colors.bg, paddingBottom: 40 },
	section: { color: colors.text, fontWeight: '800', fontSize: 16, marginTop: 8 },
	hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
	metrics: {
		backgroundColor: colors.panel,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 14,
		gap: 6
	},
	metricLine: { color: colors.text, fontSize: 14 },
	version: { color: colors.muted, fontSize: 13, marginTop: 16, textAlign: 'center' },
	row: {
		minHeight: touchMin,
		backgroundColor: colors.panel,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		paddingHorizontal: 14,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between'
	},
	rowText: { color: colors.text, fontWeight: '600' },
	input: {
		minHeight: touchMin,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel,
		color: colors.text,
		paddingHorizontal: 14
	}
});
