import { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { catalogMediaUrl } from '../catalog/mediaUrl';
import { colors, radius } from '../theme';

type Props = {
	imagePath: string | null | undefined;
	/** Square thumb edge. Ignored when `banner` is set. */
	size?: number;
	/** Wide cover (width 100%, fixed height). */
	bannerHeight?: number;
	style?: StyleProp<ViewStyle>;
	rounded?: number;
};

/** Remote catalog plate with dumbbell fallback when missing/failed. */
export function CatalogThumb({
	imagePath,
	size = 56,
	bannerHeight,
	style,
	rounded = radius.sm
}: Props) {
	const uri = catalogMediaUrl(imagePath);
	const [failed, setFailed] = useState(false);
	const showImage = Boolean(uri) && !failed;
	const banner = bannerHeight != null;
	const iconSize = banner ? Math.round(bannerHeight * 0.28) : Math.round(size * 0.42);

	return (
		<View
			style={[
				styles.wrap,
				banner
					? { width: '100%', height: bannerHeight, borderRadius: rounded }
					: { width: size, height: size, borderRadius: rounded },
				style
			]}
		>
			{showImage ? (
				<Image
					source={{ uri: uri! }}
					style={styles.img}
					resizeMode={banner ? 'contain' : 'cover'}
					onError={() => setFailed(true)}
				/>
			) : (
				<Dumbbell color={colors.muted} size={iconSize} strokeWidth={2} />
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		backgroundColor: colors.panelRaised,
		borderWidth: 1,
		borderColor: colors.border,
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center'
	},
	img: { width: '100%', height: '100%' }
});
