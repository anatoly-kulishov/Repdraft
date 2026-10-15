import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, touchMin } from '../theme';

type Props = {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	variant?: 'primary' | 'ghost' | 'danger';
};

export function PrimaryButton({ label, onPress, disabled, variant = 'primary' }: Props) {
	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.base,
				variant === 'primary' && styles.primary,
				variant === 'ghost' && styles.ghost,
				variant === 'danger' && styles.danger,
				(disabled || pressed) && styles.dim
			]}
		>
			<Text
				style={[
					styles.label,
					variant === 'primary' && styles.labelOnAccent,
					variant === 'danger' && styles.labelDanger
				]}
			>
				{label}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	base: {
		minHeight: touchMin,
		minWidth: touchMin,
		borderRadius: 14,
		paddingHorizontal: 18,
		alignItems: 'center',
		justifyContent: 'center'
	},
	primary: {
		backgroundColor: colors.accent
	},
	ghost: {
		backgroundColor: colors.panel,
		borderWidth: 1,
		borderColor: colors.border
	},
	danger: {
		backgroundColor: '#3f1d1d',
		borderWidth: 1,
		borderColor: colors.danger
	},
	dim: {
		opacity: 0.7
	},
	label: {
		color: colors.text,
		fontSize: 16,
		fontWeight: '700'
	},
	labelOnAccent: {
		color: colors.accentText
	},
	labelDanger: {
		color: colors.danger
	}
});
