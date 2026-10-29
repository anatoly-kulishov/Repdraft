import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { ClipboardList, Dumbbell, House, UserRound } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TABBAR_FLOAT_GAP, TABBAR_INNER_H } from '../../src/layout/safe';
import { useLocale } from '../../src/state/locale';
import { useAppColors, useAppTheme } from '../../src/state/theme';
import { fontFamily, radius, type ColorPalette } from '../../src/theme';
import type { ComponentType } from 'react';

/** #RRGGBB → rgba(...) so the glass tab bar can sit on top of BlurView. */
function withAlpha(hex: string, alpha: number): string {
	if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function TabIcon({
	icon: Icon,
	size,
	focused,
	colors
}: {
	icon: ComponentType<{ color: string; size: number; strokeWidth?: number }>;
	size: number;
	focused: boolean;
	colors: ColorPalette;
}) {
	return (
		<View style={[styles.iconWrap, focused && { backgroundColor: colors.accentDim }]}>
			<Icon
				color={focused ? colors.accentText : colors.muted}
				size={size}
				strokeWidth={2.25}
			/>
		</View>
	);
}

export default function TabsLayout() {
	const { tt } = useLocale();
	const colors = useAppColors();
	const { mode } = useAppTheme();
	const insets = useSafeAreaInsets();
	const bottom = Math.max(insets.bottom, 8);
	const light = mode === 'light';

	return (
		<Tabs
			screenOptions={{
				headerStyle: { backgroundColor: colors.bg },
				headerTintColor: colors.text,
				headerTitleStyle: { fontWeight: '700', fontFamily: fontFamily.bold },
				headerShadowVisible: false,
				sceneStyle: { backgroundColor: colors.bg },
				tabBarStyle: {
					position: 'absolute',
					left: TABBAR_FLOAT_GAP,
					right: TABBAR_FLOAT_GAP,
					bottom: bottom,
					height: TABBAR_INNER_H,
					minHeight: TABBAR_INNER_H,
					paddingTop: 4,
					paddingBottom: 4,
					paddingHorizontal: 4,
					backgroundColor: withAlpha(colors.panel, light ? 0.74 : 0.7),
					borderWidth: 1,
					borderColor: colors.border,
					borderRadius: radius.xl,
					overflow: 'hidden',
					...Platform.select({
						ios: {
							shadowColor: '#000',
							shadowOpacity: light ? 0.12 : 0.35,
							shadowRadius: light ? 14 : 18,
							shadowOffset: { width: 0, height: light ? 4 : 8 }
						},
						android: { elevation: light ? 6 : 12 }
					})
				},
				tabBarBackground: () => (
					<BlurView
						intensity={20}
						tint={light ? 'light' : 'dark'}
						style={StyleSheet.absoluteFill}
					/>
				),
				tabBarActiveTintColor: colors.accentText,
				tabBarInactiveTintColor: colors.muted,
				tabBarLabelStyle: {
					fontSize: 11,
					fontWeight: '600',
					fontFamily: fontFamily.semibold
				},
				tabBarItemStyle: {
					borderRadius: radius.md,
					paddingVertical: 2
				},
				tabBarShowLabel: true
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Repdraft',
					tabBarLabel: tt('tab.home'),
					tabBarIcon: ({ size, focused }) => (
						<TabIcon icon={House} size={size} focused={focused} colors={colors} />
					)
				}}
			/>
			<Tabs.Screen
				name="workouts"
				options={{
					title: tt('nav.workouts'),
					tabBarLabel: tt('nav.workouts'),
					tabBarIcon: ({ size, focused }) => (
						<TabIcon icon={ClipboardList} size={size} focused={focused} colors={colors} />
					)
				}}
			/>
			<Tabs.Screen
				name="exercises"
				options={{
					title: tt('tab.exercises'),
					tabBarLabel: tt('tab.exercises'),
					tabBarIcon: ({ size, focused }) => (
						<TabIcon icon={Dumbbell} size={size} focused={focused} colors={colors} />
					)
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: tt('tab.profile'),
					tabBarLabel: tt('tab.profile'),
					tabBarIcon: ({ size, focused }) => (
						<TabIcon icon={UserRound} size={size} focused={focused} colors={colors} />
					)
				}}
			/>
		</Tabs>
	);
}

const styles = StyleSheet.create({
	iconWrap: {
		width: 40,
		height: 28,
		borderRadius: radius.sm,
		alignItems: 'center',
		justifyContent: 'center'
	}
});
