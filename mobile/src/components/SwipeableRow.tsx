import { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import ReanimatedSwipeable, {
	type SwipeableMethods
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SharedValue } from 'react-native-reanimated';
import { useAppColors } from '../state/theme';
import { fontFamily, type ColorPalette } from '../theme';

type Props = {
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
	onDelete: () => void;
	deleteLabel: string;
};

const DELETE_WIDTH = 88;

/** Only one row open at a time (iOS lists otherwise keep stale open rows). */
let openSwipeable: SwipeableMethods | null = null;

export function SwipeableRow({ children, style, onDelete, deleteLabel }: Props) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const swipeableRef = useRef<SwipeableMethods>(null);

	const renderRightActions = useCallback(
		(
			_progress: SharedValue<number>,
			_translation: SharedValue<number>,
			methods: SwipeableMethods
		) => (
			// Fixed width wrapper: ReanimatedSwipeable measures action width via a
			// trailing layout sentinel. `flex: 1` on the action itself expands to the
			// full row and makes open snap the content completely off-screen.
			<View style={styles.deleteWrap}>
				<RectButton
					accessibilityRole="button"
					accessibilityLabel={deleteLabel}
					style={styles.deleteBtn}
					onPress={() => {
						methods.close();
						onDelete();
					}}
				>
					<Text style={styles.deleteLabel}>{deleteLabel}</Text>
				</RectButton>
			</View>
		),
		[deleteLabel, onDelete, styles.deleteBtn, styles.deleteLabel, styles.deleteWrap]
	);

	return (
		<ReanimatedSwipeable
			ref={swipeableRef}
			containerStyle={[styles.container, style]}
			renderRightActions={renderRightActions}
			friction={2}
			rightThreshold={DELETE_WIDTH / 2}
			overshootRight={false}
			overshootFriction={8}
			dragOffsetFromLeft={24}
			dragOffsetFromRight={-24}
			onSwipeableWillOpen={() => {
				const self = swipeableRef.current;
				if (openSwipeable && openSwipeable !== self) {
					openSwipeable.close();
				}
				openSwipeable = self;
			}}
			onSwipeableClose={() => {
				if (openSwipeable === swipeableRef.current) {
					openSwipeable = null;
				}
			}}
		>
			{children}
		</ReanimatedSwipeable>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		container: {
			overflow: 'hidden'
		},
		deleteWrap: {
			width: DELETE_WIDTH,
			alignSelf: 'stretch'
		},
		deleteBtn: {
			flex: 1,
			backgroundColor: colors.danger,
			justifyContent: 'center',
			alignItems: 'center'
		},
		deleteLabel: {
			color: '#fff',
			fontWeight: '800',
			fontSize: 13,
			fontFamily: fontFamily.extrabold
		}
	});
}
