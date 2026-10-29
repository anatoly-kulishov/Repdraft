import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Moon, Sun, UserRound } from 'lucide-react-native';
import { useLocale } from '../state/locale';
import { useAppColors, useAppTheme } from '../state/theme';
import { fontFamily, space, type ColorPalette } from '../theme';

type Props = {
	avatarUrl: string | null;
	greeting: string;
};

/** Greeting row: avatar, greeting and the light/dark theme toggle. */
export function HomeHeader({ avatarUrl, greeting }: Props) {
	const { tt } = useLocale();
	const { mode, cycleMode } = useAppTheme();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<View style={styles.row}>
			{avatarUrl ? (
				<Image source={{ uri: avatarUrl }} style={styles.avatar} />
			) : (
				<View style={[styles.avatar, styles.avatarFallback]}>
					<UserRound size={16} color={colors.text} strokeWidth={2} />
				</View>
			)}
			<Text style={styles.greeting} numberOfLines={1}>
				{greeting}
			</Text>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={tt('settings.theme')}
				hitSlop={4}
				style={({ pressed }) => [styles.themeBtn, pressed && styles.pressed]}
				onPress={cycleMode}
			>
				{mode === 'dark' ? (
					<Sun color={colors.mutedSoft} size={16} strokeWidth={2} />
				) : (
					<Moon color={colors.mutedSoft} size={16} strokeWidth={2} />
				)}
			</Pressable>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		row: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.md,
			minHeight: 40
		},
		avatar: {
			width: 40,
			height: 40,
			borderRadius: 20,
			backgroundColor: colors.panel,
			borderWidth: 1,
			borderColor: colors.borderGlass
		},
		avatarFallback: {
			alignItems: 'center',
			justifyContent: 'center'
		},
		greeting: {
			color: colors.text,
			flex: 1,
			fontSize: 16,
			lineHeight: 22,
			fontWeight: '500',
			fontFamily: fontFamily.medium
		},
		themeBtn: {
			width: 40,
			height: 40,
			borderRadius: 20,
			padding: space.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel,
			alignItems: 'center',
			justifyContent: 'center'
		},
		pressed: { opacity: 0.85 }
	});
}
