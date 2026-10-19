import { authErrorMessageKey, passwordsMatch, passwordPolicyMessageKey, validatePasswordPolicy } from '@repdraft/domain/authFlow';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { consumeAuthUrl, type ConsumedAuthLink } from '../src/auth/emailLink';
import { getSupabase } from '../src/auth/supabase';
import { Panel } from '../src/components/Panel';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { useLocale } from '../src/state/locale';
import { useAppColors } from '../src/state/theme';
import { pullAndMergeFromCloud } from '../src/sync/cloudSync';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../src/theme';

type Phase = 'pending' | 'recovery' | 'error';

function messageOf(tt: (key: string) => string, result: Extract<ConsumedAuthLink, { status: 'error' }>): string {
	return result.key ? tt(result.key) : result.fallback;
}

/** Email confirm, magic link, and password recovery. Sign-in itself stays on Profile. */
export default function AuthCallback() {
	const router = useRouter();
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const url = Linking.useURL();
	const [phase, setPhase] = useState<Phase>('pending');
	const [errorText, setErrorText] = useState('');
	const [password, setPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const target = url ?? (await Linking.getInitialURL());
			if (cancelled) return;
			if (!target) {
				router.replace('/(tabs)/profile');
				return;
			}
			const result = await consumeAuthUrl(target);
			if (cancelled) return;
			if (result.status === 'empty') {
				router.replace('/(tabs)/profile');
				return;
			}
			if (result.status === 'error') {
				setErrorText(messageOf(tt, result));
				setPhase('error');
				return;
			}
			if (result.status === 'recovery') {
				setPhase('recovery');
				return;
			}
			await pullAndMergeFromCloud().catch(() => undefined);
			if (!cancelled) router.replace('/(tabs)/profile');
		})();
		return () => {
			cancelled = true;
		};
	}, [router, tt, url]);

	async function savePassword() {
		const sb = getSupabase();
		if (!sb) {
			setErrorText(tt('errors.cloudOff'));
			setPhase('error');
			return;
		}
		if (!passwordsMatch(password, confirm)) {
			setErrorText(tt('auth.errors.passwordMismatch'));
			return;
		}
		const { data } = await sb.auth.getSession();
		const email = data.session?.user.email ?? '';
		const policyReason = validatePasswordPolicy(password, email);
		if (policyReason !== 'ok') {
			setErrorText(tt(passwordPolicyMessageKey(policyReason)));
			return;
		}
		setBusy(true);
		const { error } = await sb.auth.updateUser({ password });
		setBusy(false);
		if (error) {
			const key = authErrorMessageKey(error);
			setErrorText(key ? tt(key) : error.message);
			return;
		}
		await pullAndMergeFromCloud().catch(() => undefined);
		router.replace('/(tabs)/profile');
	}

	return (
		<View style={styles.screen}>
			{phase === 'pending' ? <Text style={styles.hint}>{tt('auth.wait')}</Text> : null}
			{phase === 'error' ? (
				<Panel>
					<Text style={styles.title}>{tt('common.error')}</Text>
					<Text style={styles.hint}>{errorText}</Text>
					<PrimaryButton
						label={tt('common.back')}
						onPress={() => router.replace('/(tabs)/profile')}
					/>
				</Panel>
			) : null}
			{phase === 'recovery' ? (
				<Panel>
					<Text style={styles.title}>{tt('auth.recoveryTitle')}</Text>
					<Text style={styles.hint}>{tt('auth.recoveryLead')}</Text>
					<TextInput
						style={styles.input}
						secureTextEntry
						autoCapitalize="none"
						placeholder={tt('auth.passwordPh')}
						placeholderTextColor={colors.muted}
						value={password}
						onChangeText={setPassword}
					/>
					<TextInput
						style={styles.input}
						secureTextEntry
						autoCapitalize="none"
						placeholder={tt('auth.passwordConfirmPh')}
						placeholderTextColor={colors.muted}
						value={confirm}
						onChangeText={setConfirm}
					/>
					{errorText ? <Text style={styles.error}>{errorText}</Text> : null}
					<PrimaryButton
						label={busy ? tt('auth.wait') : tt('auth.submitNewPassword')}
						onPress={() => void savePassword()}
						disabled={busy || !password || !confirm}
					/>
				</Panel>
			) : null}
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		screen: {
			flex: 1,
			backgroundColor: colors.bg,
			padding: space.lg,
			gap: space.md
		},
		title: { color: colors.text, fontSize: 17, fontWeight: '700', fontFamily: fontFamily.bold },
		hint: { color: colors.muted, fontSize: 15, lineHeight: 22, fontFamily: fontFamily.regular },
		error: { color: colors.danger, fontSize: 15, lineHeight: 22, fontFamily: fontFamily.regular },
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
