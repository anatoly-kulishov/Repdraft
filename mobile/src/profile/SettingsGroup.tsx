import type { ReactNode } from 'react';
import { Children, Fragment, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, type ColorPalette } from '../theme';

type Props = {
	label?: string;
	hint?: string;
	children: ReactNode;
};

export function SettingsGroup({ label, hint, children }: Props) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const items = Children.toArray(children).filter(Boolean);

	return (
		<View style={styles.wrap}>
			{label ? <Text style={styles.label}>{label}</Text> : null}
			<View style={styles.card}>
				{items.map((child, index) => (
					<Fragment key={index}>
						{index > 0 ? <View style={styles.divider} /> : null}
						{child}
					</Fragment>
				))}
			</View>
			{hint ? <Text style={styles.hint}>{hint}</Text> : null}
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		wrap: { gap: 6 },
		label: {
			paddingHorizontal: 4,
			fontFamily: fontFamily.semibold,
			fontSize: 11,
			letterSpacing: 0.8,
			textTransform: 'uppercase',
			color: colors.muted
		},
		card: {
			borderRadius: radius.md,
			backgroundColor: colors.panel,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.border,
			paddingHorizontal: 12,
			paddingVertical: 0,
			overflow: 'hidden'
		},
		divider: {
			height: StyleSheet.hairlineWidth,
			backgroundColor: colors.border,
			marginLeft: 30
		},
		hint: {
			paddingHorizontal: 4,
			fontFamily: fontFamily.regular,
			fontSize: 12,
			lineHeight: 17,
			color: colors.muted
		}
	});
}
