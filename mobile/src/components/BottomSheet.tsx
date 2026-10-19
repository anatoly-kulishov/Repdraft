import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle
} from 'react-native';
import { useBottomChromePad } from '../layout/safe';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, type ColorPalette } from '../theme';

type Props = {
	/** Mirror web `open`. */
	open: boolean;
	onDismiss?: () => void;
	/** When false, backdrop tap does not dismiss (escape still calls onRequestClose → onDismiss). */
	dismissible?: boolean;
	/** Slightly taller lift for keyboard-heavy sheets. */
	raised?: boolean;
	/** Optional a11y label for the sheet card. */
	label?: string | null;
	children: ReactNode;
	/** Footer row (primary/secondary actions), like web `actions` snippet. */
	actions?: ReactNode;
	contentStyle?: StyleProp<ViewStyle>;
	/** Max height of the card (default 78%). */
	maxHeight?: `${number}%` | number;
};

/**
 * Shared bottom sheet shell (web `BottomSheet.svelte` twin).
 * Modal + scrim + card + safe-area pad. Feature sheets compose content inside.
 */
export function BottomSheet({
	open,
	onDismiss,
	dismissible = true,
	raised = false,
	label,
	children,
	actions,
	contentStyle,
	maxHeight = '78%'
}: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);

	function requestClose() {
		onDismiss?.();
	}

	function onBackdrop() {
		if (!dismissible) return;
		requestClose();
	}

	return (
		<Modal visible={open} animationType="slide" transparent onRequestClose={requestClose}>
			<KeyboardAvoidingView
				style={styles.host}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={tt('common.close')}
					style={styles.backdrop}
					onPress={onBackdrop}
				/>
				<View
					accessibilityLabel={label ?? undefined}
					style={[
						styles.card,
						raised && styles.cardRaised,
						{ paddingBottom: bottomPad, maxHeight },
						contentStyle
					]}
				>
					<View style={styles.handle} />
					{children}
					{actions ? <View style={styles.actions}>{actions}</View> : null}
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		host: {
			flex: 1,
			justifyContent: 'flex-end'
		},
		backdrop: {
			...StyleSheet.absoluteFill,
			backgroundColor: colors.overlayScrim
		},
		card: {
			backgroundColor: colors.panel,
			borderTopLeftRadius: radius.xl,
			borderTopRightRadius: radius.xl,
			borderTopWidth: 1,
			borderColor: colors.border,
			paddingHorizontal: space.lg,
			paddingTop: space.md,
			gap: space.md
		},
		cardRaised: {
			backgroundColor: colors.bg
		},
		handle: {
			alignSelf: 'center',
			width: 40,
			height: 4,
			borderRadius: radius.pill,
			backgroundColor: colors.border,
			marginBottom: 2
		},
		actions: {
			gap: space.sm,
			paddingTop: space.xs
		}
	});
}
