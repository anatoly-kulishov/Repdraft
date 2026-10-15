import { localizedChangelog } from '@repdraft/domain/changelog';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, touchMin } from '../theme';

type Props = {
	visible: boolean;
	onClose: () => void;
};

export function WhatsNewSheet({ visible, onClose }: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const insets = useSafeAreaInsets();

	if (!visible) return null;

	return (
		<View style={styles.wrap} pointerEvents="box-none">
			<Pressable
				accessibilityRole="button"
				style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
				onPress={onClose}
			/>
			<View
				style={[
					styles.sheet,
					{
						backgroundColor: colors.panel,
						borderColor: colors.border,
						paddingBottom: Math.max(insets.bottom, space.lg)
					}
				]}
			>
				<Text style={[styles.title, { color: colors.text }]}>{tt('changelog.title')}</Text>
				<Text style={[styles.lead, { color: colors.muted }]}>{tt('changelog.lead')}</Text>
				<ScrollView style={styles.scroll} contentContainerStyle={{ gap: space.md }}>
					{localizedChangelog(locale, 5).map((release) => (
						<View key={release.version}>
							<Text style={[styles.version, { color: colors.accent }]}>{release.label}</Text>
							{release.highlights.map((line) => (
								<Text key={line} style={[styles.bullet, { color: colors.muted }]}>
									{'• '}
									{line}
								</Text>
							))}
						</View>
					))}
				</ScrollView>
				<Pressable
					accessibilityRole="button"
					style={[styles.closeBtn, { backgroundColor: colors.panelRaised, borderColor: colors.border }]}
					onPress={onClose}
				>
					<Text style={[styles.closeLabel, { color: colors.text }]}>{tt('common.close')}</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		...StyleSheet.absoluteFill,
		justifyContent: 'flex-end',
		zIndex: 100
	},
	sheet: {
		maxHeight: '78%',
		borderTopLeftRadius: radius.xl,
		borderTopRightRadius: radius.xl,
		borderWidth: 1,
		padding: space.lg,
		gap: space.md
	},
	title: { fontSize: 20, fontWeight: '800' },
	lead: { fontSize: 14, lineHeight: 20 },
	scroll: { flexGrow: 0 },
	version: { fontWeight: '800', fontSize: 15, marginBottom: 4 },
	bullet: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
	closeBtn: {
		minHeight: touchMin,
		borderRadius: radius.md,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center'
	},
	closeLabel: { fontWeight: '700', fontSize: 16 }
});
