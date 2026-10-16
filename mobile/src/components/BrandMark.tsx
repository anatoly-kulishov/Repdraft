import { Image, View } from 'react-native';
import { useAppColors } from '../state/theme';
import { radius } from '../theme';

/** Round-cornered brand mark. Uses theme accent background so it works in dark and light. */
export function BrandMark({ size = 32 }: { size?: number }) {
	const colors = useAppColors();
	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius: radius.md,
				backgroundColor: colors.accent,
				overflow: 'hidden'
			}}
		>
			<Image
				source={require('../../assets/brand-mark-pulse.png')}
				style={{ width: size, height: size }}
				accessibilityRole="image"
				accessibilityLabel="Repdraft"
			/>
		</View>
	);
}
