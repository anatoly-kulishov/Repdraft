import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, HelpCircle, Settings } from 'lucide-react-native';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	onBack: () => void;
	onHelp: () => void;
	onSettings: () => void;
};

/** Fixed screen header: back, big title, help and settings (44px targets). */
export function ClientsHeader({ onBack, onHelp, onSettings }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const insets = useSafeAreaInsets();

	return (
		<View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={tt('a11y.back')}
				hitSlop={4}
				style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
				onPress={onBack}
			>
				<ArrowLeft color={colors.text} size={24} strokeWidth={2} />
			</Pressable>
			<Text style={styles.title} numberOfLines={1}>
				{tt('coach.pageTitle')}
			</Text>
			<View style={styles.actions}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={tt('coach.help')}
					hitSlop={4}
					style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
					onPress={onHelp}
				>
					<HelpCircle color={colors.muted} size={24} strokeWidth={1.75} />
				</Pressable>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={tt('coach.settings')}
					hitSlop={4}
					style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
					onPress={onSettings}
				>
					<Settings color={colors.muted} size={24} strokeWidth={1.75} />
				</Pressable>
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		header: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			paddingHorizontal: space.lg,
			paddingBottom: space.sm
		},
		icon: {
			width: touchMin,
			height: touchMin,
			alignItems: 'center',
			justifyContent: 'center'
		},
		actions: { flexDirection: 'row', alignItems: 'center' },
		title: {
			flex: 1,
			color: colors.text,
			fontSize: 28,
			lineHeight: 34,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		pressed: { opacity: 0.85 }
	});
}
