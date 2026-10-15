import { Image } from 'react-native';
import { useAppColors } from '../state/theme';
import { radius } from '../theme';

/** Round-cornered brand mark, same asset as web BrandMark fallback. */
export function BrandMark({ size = 32 }: { size?: number }) {
	const colors = useAppColors();
	return (
		<Image
			source={require('../../assets/brand-mark.png')}
			style={{
				width: size,
				height: size,
				borderRadius: radius.md,
				backgroundColor: colors.panelRaised
			}}
			accessibilityRole="image"
			accessibilityLabel="Repdraft"
		/>
	);
}