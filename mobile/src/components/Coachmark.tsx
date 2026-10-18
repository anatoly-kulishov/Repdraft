import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, touchMin, type, type ColorPalette } from '../theme';

type Props = {
	message: string;
	onDismiss: () => void;
};

export function Coachmark({ message, onDismiss }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<View style={styles.root}>
			<View style={styles.body}>
				<Sparkles color={colors.accent} size={18} strokeWidth={2.25} />
				<Text style={styles.text}>{message}</Text>
			</View>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={tt('a11y.close')}
				style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
				onPress={onDismiss}
			>
				<X color={colors.muted} size={18} strokeWidth={2.25} />
			</Pressable>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel,
			padding: space.md
		},
		body: {
			flex: 1,
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm
		},
		text: {
			...type.body,
			color: colors.text,
			fontSize: 14,
			lineHeight: 20,
			flex: 1
		},
		dismiss: {
			minHeight: touchMin,
			minWidth: touchMin,
			alignItems: 'center',
			justifyContent: 'center'
		},
		pressed: { opacity: 0.72 }
	});
}
