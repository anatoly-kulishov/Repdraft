import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, tabbar } from '../theme';

/** Matches floating pill tab bar in `app/(tabs)/_layout.tsx` (web tokens). */
export const TABBAR_FLOAT_GAP = tabbar.floatGap;
export const TABBAR_INNER_H = tabbar.innerH;

/** Bottom padding for sticky footers / sheets above the home indicator. */
export function useBottomChromePad(extra: number = space.lg): number {
	const insets = useSafeAreaInsets();
	return Math.max(insets.bottom, space.sm) + extra;
}

/** List/scroll bottom inset on tab screens (floating pill tab bar). */
export function useTabScreenPad(extra: number = space.md): number {
	const insets = useSafeAreaInsets();
	const bottom = Math.max(insets.bottom, 8);
	return TABBAR_INNER_H + bottom + TABBAR_FLOAT_GAP + extra;
}

/** Stack header + status bar for KeyboardAvoidingView on iOS. */
export function useStackHeaderOffset(): number {
	const insets = useSafeAreaInsets();
	return insets.top + 44;
}
