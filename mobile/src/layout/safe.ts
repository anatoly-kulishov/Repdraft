import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, touchMin } from '../theme';

/** Bottom padding for sticky footers / sheets above the home indicator. */
export function useBottomChromePad(extra: number = space.lg): number {
	const insets = useSafeAreaInsets();
	return Math.max(insets.bottom, space.sm) + extra;
}

/** List/scroll bottom inset on tab screens (matches `app/(tabs)/_layout.tsx` tab bar). */
export function useTabScreenPad(extra: number = space.md): number {
	const insets = useSafeAreaInsets();
	const bottom = Math.max(insets.bottom, 8);
	return touchMin + bottom + 14 + extra;
}

/** Stack header + status bar for KeyboardAvoidingView on iOS. */
export function useStackHeaderOffset(): number {
	const insets = useSafeAreaInsets();
	return insets.top + 44;
}
