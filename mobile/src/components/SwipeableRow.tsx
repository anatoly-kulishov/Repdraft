import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	children: React.ReactNode;
	style?: ViewStyle;
	onDelete: () => void;
	deleteLabel: string;
};

export function SwipeableRow({ children, style, onDelete, deleteLabel }: Props) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	function renderRightActions() {
		return (
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={deleteLabel}
				style={styles.deleteBtn}
				onPress={onDelete}
			>
				<Text style={styles.deleteLabel}>{deleteLabel}</Text>
			</Pressable>
		);
	}

	return (
		<View style={style}>
			<ReanimatedSwipeable
				renderRightActions={() => renderRightActions()}
				friction={2}
				rightThreshold={40}
			>
				{children}
			</ReanimatedSwipeable>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		deleteBtn: {
			backgroundColor: colors.danger,
			minWidth: 88,
			minHeight: touchMin,
			justifyContent: 'center',
			alignItems: 'center',
			borderTopRightRadius: radius.md,
			borderBottomRightRadius: radius.md,
			marginVertical: 1
		},
		deleteLabel: {
			color: '#fff',
			fontWeight: '800',
			fontSize: 13,
			fontFamily: fontFamily.extrabold
		}
	});
}
