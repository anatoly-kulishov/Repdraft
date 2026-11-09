import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { deleteCloudAccount, signOutEverywhere } from '../../src/auth/accountApi';
import { getSupabase } from '../../src/auth/supabase';
import { webOrigin } from '../../src/catalog/mediaUrl';
import { ConfirmSheet } from '../../src/components/ConfirmSheet';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';

export default function SettingsAccountScreen() {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const [logoutOpen, setLogoutOpen] = useState(false);
	const [logoutEverywhereOpen, setLogoutEverywhereOpen] = useState(false);
	const [busy, setBusy] = useState(false);

	async function signOut() {
		const sb = getSupabase();
		if (!sb) return;
		await sb.auth.signOut();
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

	function confirmDelete() {
		Alert.alert(tt('auth.deleteTitle'), tt('auth.deleteLead'), [
			{ text: tt('common.cancel'), style: 'cancel' },
			{
				text: tt('auth.deleteButton'),
				style: 'destructive',
				onPress: () => {
					void (async () => {
						setBusy(true);
						try {
							await deleteCloudAccount();
							Alert.alert(tt('common.ok'), tt('auth.deleteDone'));
						} catch (err) {
							Alert.alert(
								tt('common.error'),
								err instanceof Error ? err.message : tt('auth.deleteFail')
							);
						} finally {
							setBusy(false);
						}
					})();
				}
			}
		]);
	}

	return (
		<>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
			>
				<Pressable
					style={styles.row}
					onPress={() => void WebBrowser.openBrowserAsync(`${webOrigin()}/terms`)}
				>
					<Text style={styles.rowText}>{tt('terms.link')}</Text>
					<Text style={styles.value}>→</Text>
				</Pressable>
				<Pressable
					style={styles.row}
					onPress={() => void WebBrowser.openBrowserAsync(`${webOrigin()}/privacy`)}
				>
					<Text style={styles.rowText}>{tt('privacy.link')}</Text>
					<Text style={styles.value}>→</Text>
				</Pressable>
				<PrimaryButton
					label={tt('profile.signOut')}
					variant="ghost"
					onPress={() => setLogoutOpen(true)}
					disabled={busy}
				/>
				<Text style={styles.hint}>{tt('auth.logoutEverywhereHint')}</Text>
				<PrimaryButton
					label={tt('auth.logoutEverywhere')}
					variant="ghost"
					onPress={() => setLogoutEverywhereOpen(true)}
					disabled={busy}
				/>
				<View style={styles.danger}>
					<Text style={styles.dangerTitle}>{tt('auth.deleteTitle')}</Text>
					<PrimaryButton
						label={tt('auth.deleteButton')}
						variant="ghost"
						onPress={confirmDelete}
						disabled={busy}
					/>
				</View>
			</ScrollView>
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
		</>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: 10 },
		row: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: 12,
			paddingHorizontal: 14,
			backgroundColor: colors.panel
		},
		rowText: { fontFamily: fontFamily.medium, fontSize: 15, color: colors.text },
		value: { fontFamily: fontFamily.medium, color: colors.muted },
		hint: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.muted },
		danger: {
			marginTop: space.md,
			gap: 8,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.border,
			paddingTop: space.md
		},
		dangerTitle: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.danger }
	});
}
