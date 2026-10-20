import { Tabs } from 'expo-router';
import { ClipboardList, Dumbbell, House, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, touchMin } from '../../src/theme';

export default function TabsLayout() {
	const { tt } = useLocale();
	const colors = useAppColors();
	const insets = useSafeAreaInsets();
	const bottom = Math.max(insets.bottom, 8);

	return (
		<Tabs
			screenOptions={{
				headerStyle: { backgroundColor: colors.bg },
				headerTintColor: colors.text,
				headerTitleStyle: { fontWeight: '800', fontFamily: fontFamily.extrabold },
				headerShadowVisible: false,
				tabBarStyle: {
					backgroundColor: colors.bg,
					borderTopColor: colors.border,
					minHeight: touchMin + bottom + 8,
					paddingTop: 6,
					paddingBottom: bottom,
					height: touchMin + bottom + 14
				},
				tabBarActiveTintColor: colors.accent,
				tabBarInactiveTintColor: colors.muted,
				tabBarLabelStyle: { fontSize: 11, fontWeight: '700', fontFamily: fontFamily.bold },
				tabBarShowLabel: true
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Repdraft',
					tabBarLabel: tt('tab.home'),
					tabBarIcon: ({ color, size }) => (
						<House color={color} size={size} strokeWidth={2.25} />
					)
				}}
			/>
			<Tabs.Screen
				name="workouts"
				options={{
					title: tt('nav.workouts'),
					tabBarLabel: tt('nav.workouts'),
					tabBarIcon: ({ color, size }) => (
						<ClipboardList color={color} size={size} strokeWidth={2.25} />
					)
				}}
			/>
			<Tabs.Screen
				name="exercises"
				options={{
					title: tt('tab.exercises'),
					tabBarLabel: tt('tab.exercises'),
					tabBarIcon: ({ color, size }) => (
						<Dumbbell color={color} size={size} strokeWidth={2.25} />
					)
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: tt('tab.profile'),
					tabBarLabel: tt('tab.profile'),
					tabBarIcon: ({ color, size }) => (
						<UserRound color={color} size={size} strokeWidth={2.25} />
					)
				}}
			/>
		</Tabs>
	);
}
