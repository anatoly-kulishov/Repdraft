import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Camera, Crown } from 'lucide-react-native';
import { proFromAppMetadata } from '@repdraft/domain/entitlement';
import { billingSubscribeUrl, fetchBillingStatus } from '../../src/auth/accountApi';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { getSupabase } from '../../src/auth/supabase';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, space, type ColorPalette } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';

export default function SettingsProScreen() {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const [showPro, setShowPro] = useState(false);
	const [proUntilLabel, setProUntilLabel] = useState<string | null>(null);

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				const sb = getSupabase();
				if (!sb) {
					setShowPro(false);
					setProUntilLabel(null);
					return;
				}
				const { data } = await sb.auth.getUser();
				const meta = proFromAppMetadata(
					data.user?.app_metadata as Record<string, unknown> | undefined
				);
				const remote = await fetchBillingStatus();
				setShowPro(remote?.pro ?? meta.pro);
				setProUntilLabel(remote?.currentPeriodEnd ?? meta.proUntil);
			})();
		}, [])
	);

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<View style={styles.card}>
				<View style={styles.head}>
					<Crown color={colors.accent} size={22} strokeWidth={2.25} />
					<View style={styles.headText}>
						<View style={styles.titleRow}>
							<Text style={styles.title}>{tt('billing.title')}</Text>
							{showPro ? (
								<View style={styles.badge}>
									<Text style={styles.badgeText}>{tt('billing.activeBadge')}</Text>
								</View>
							) : null}
						</View>
						<Text style={styles.hint}>
							{showPro
								? proUntilLabel
									? tt('billing.activeUntil', { date: proUntilLabel.slice(0, 10) })
									: tt('billing.active')
								: tt('billing.lead')}
						</Text>
					</View>
				</View>
				<View style={styles.feature}>
					<Camera color={colors.accent} size={18} strokeWidth={2.25} />
					<Text style={styles.featureText}>{tt('billing.benefitRecognize')}</Text>
				</View>
				{!showPro ? (
					<>
						<Text style={styles.hint}>{tt('billing.openOnWebHint')}</Text>
						<PrimaryButton
							label={tt('billing.openOnWeb')}
							onPress={() => void WebBrowser.openBrowserAsync(billingSubscribeUrl())}
						/>
					</>
				) : null}
			</View>
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg },
		card: {
			borderWidth: 1,
			borderColor: colors.border,
			borderLeftWidth: 3,
			borderLeftColor: colors.accent,
			borderRadius: 16,
			padding: space.md,
			gap: 14,
			backgroundColor: colors.panel
		},
		head: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
		headText: { flex: 1, gap: 4 },
		titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
		title: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.text },
		badge: {
			paddingHorizontal: 8,
			paddingVertical: 2,
			borderRadius: 999,
			backgroundColor: colors.accent,
			minHeight: 24,
			justifyContent: 'center'
		},
		badgeText: {
			fontFamily: fontFamily.bold,
			fontSize: 11,
			letterSpacing: 0.3,
			textTransform: 'uppercase',
			color: colors.accentInk ?? '#fff'
		},
		hint: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.muted },
		feature: {
			flexDirection: 'row',
			gap: 10,
			alignItems: 'center',
			minHeight: 48,
			paddingTop: 12,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.border
		},
		featureText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 15, color: colors.text }
	});
}
