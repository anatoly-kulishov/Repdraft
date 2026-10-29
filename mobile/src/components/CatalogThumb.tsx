import { useMemo, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { catalogMediaUrl } from '../catalog/mediaUrl';
import { useAppColors, useAppTheme } from '../state/theme';
import { radius, type ColorPalette } from '../theme';

type Props = {
	imagePath: string | null | undefined;
	/** Square thumb edge. Ignored when `banner` is set. */
	size?: number;
	/** Wide cover (width 100%, fixed height). */
	bannerHeight?: number;
	style?: StyleProp<ViewStyle>;
	rounded?: number;
	/** Gym visual plates: white media well on dark screens. */
	whitePlate?: boolean;
};

/** Remote catalog plate with dumbbell fallback when missing/failed. */
export function CatalogThumb({
	imagePath,
	size = 56,
	bannerHeight,
	style,
	rounded = radius.sm,
	whitePlate = true
}: Props) {
	const colors = useAppColors();
	const { mode } = useAppTheme();
	const dimWhitePlate = mode === 'dark' && whitePlate;
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const uri = catalogMediaUrl(imagePath);
	const [failed, setFailed] = useState(false);
	const showImage = Boolean(uri) && !failed;
	const banner = bannerHeight != null;
	const iconSize = banner ? Math.round(bannerHeight * 0.28) : Math.round(size * 0.42);

	return (
		<View
			style={[
				styles.wrap,
				whitePlate && styles.wrapWhite,
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
			{dimWhitePlate ? <View style={styles.darkScrim} pointerEvents="none" /> : null}
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		wrap: {
			backgroundColor: colors.panelRaised,
			borderWidth: 1,
			borderColor: colors.border,
			overflow: 'hidden',
			alignItems: 'center',
			justifyContent: 'center'
		},
		wrapWhite: {
			backgroundColor: '#ffffff',
			borderColor: 'rgba(0, 0, 0, 0.06)'
		},
		/** Dark theme only: soften the bright white gym plate. */
		darkScrim: {
			position: 'absolute',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			backgroundColor: 'rgba(0, 0, 0, 0.20)'
		},
		img: { width: '100%', height: '100%' }
	});
}
