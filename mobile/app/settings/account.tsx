import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { FileText, Shield } from 'lucide-react-native';
import { deleteCloudAccount, signOutEverywhere } from '../../src/auth/accountApi';
import { getSupabase } from '../../src/auth/supabase';
import { webOrigin } from '../../src/catalog/mediaUrl';
import { ConfirmSheet } from '../../src/components/ConfirmSheet';
import { SettingsGroup } from '../../src/profile/SettingsGroup';
import {
	SettingsDeleteButton,
	SettingsFooterButton,
	SettingsRow
} from '../../src/profile/SettingsRow';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { space } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';

export default function SettingsAccountScreen() {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors.bg), [colors.bg]);
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
				<SettingsGroup label={tt('settings.group.support')}>
					<SettingsRow
						icon={FileText}
						label={tt('terms.link')}
						onPress={() => void WebBrowser.openBrowserAsync(`${webOrigin()}/terms`)}
					/>
					<SettingsRow
						icon={Shield}
						label={tt('privacy.link')}
						onPress={() => void WebBrowser.openBrowserAsync(`${webOrigin()}/privacy`)}
					/>
				</SettingsGroup>

				<SettingsGroup label={tt('settings.group.account')} hint={tt('auth.logoutEverywhereHint')}>
					<SettingsRow
						label={tt('auth.logoutEverywhere')}
						chevron={false}
						disabled={busy}
						onPress={() => setLogoutEverywhereOpen(true)}
					/>
				</SettingsGroup>

				<SettingsFooterButton
					label={tt('profile.signOut')}
					disabled={busy}
					onPress={() => setLogoutOpen(true)}
				/>
				<SettingsDeleteButton
					label={tt('auth.deleteButton')}
					disabled={busy}
					onPress={confirmDelete}
				/>
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

function makeStyles(bg: string) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: bg },
		root: { padding: space.lg, gap: space.md }
	});
}
