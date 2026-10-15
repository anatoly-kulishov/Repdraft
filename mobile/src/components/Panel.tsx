import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppColors } from '../state/theme';
import { radius, space, type ColorPalette } from '../theme';

type Props = {
	children: ReactNode;
	style?: StyleProp<ViewStyle>;
	accent?: boolean;
};

export function Panel({ children, style, accent }: Props) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	return <View style={[styles.panel, accent && styles.accent, style]}>{children}</View>;
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		panel: {
			backgroundColor: colors.panel,
			borderRadius: radius.lg,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.lg,
			gap: space.sm
		},
		accent: {
			borderColor: colors.accent
		}
	});
}
