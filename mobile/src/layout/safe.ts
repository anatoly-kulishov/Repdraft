import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../theme';

/** Bottom padding for sticky footers / sheets above the home indicator. */
export function useBottomChromePad(extra: number = space.lg): number {
	const insets = useSafeAreaInsets();
	return Math.max(insets.bottom, space.sm) + extra;
}
