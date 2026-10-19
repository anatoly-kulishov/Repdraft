import { View } from 'react-native';
import Svg, { Defs, Image as SvgImage, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { useLocale } from '../state/locale';
import { radius } from '../theme';

const markPulse = require('../../assets/brand-mark-pulse.png') as number;

/** Round-cornered brand mark. Violet gradient plate with white RP mark. */
export function BrandMark({ size = 32 }: { size?: number }) {
	const { tt } = useLocale();
	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius: radius.md,
				overflow: 'hidden'
			}}
			accessibilityRole="image"
			accessibilityLabel={tt('app.name')}
		>
			<Svg width={size} height={size} viewBox="0 0 512 512">
				<Defs>
					<SvgLinearGradient id="brandMarkBg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
						<Stop offset="0%" stopColor="#8b5cf6" />
						<Stop offset="62%" stopColor="#a78bfa" />
						<Stop offset="100%" stopColor="#c4b5fd" />
					</SvgLinearGradient>
				</Defs>
				<Rect width="512" height="512" fill="url(#brandMarkBg)" />
				<SvgImage
					href={markPulse}
					x="0"
					y="0"
					width="512"
					height="512"
					preserveAspectRatio="xMidYMid meet"
				/>
			</Svg>
		</View>
	);
}
