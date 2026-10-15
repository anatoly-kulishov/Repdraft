import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useLocale } from '../../src/state/locale';
import { colors, touchMin } from '../../src/theme';

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
	return (
		<Text style={{ color: focused ? colors.accent : colors.muted, fontSize: 11, fontWeight: '700' }}>
			{label}
		</Text>
	);
}

export default function TabsLayout() {
	const { tt } = useLocale();
	return (
		<Tabs
			screenOptions={{
				headerStyle: { backgroundColor: colors.bg },
				headerTintColor: colors.text,
				headerShadowVisible: false,
				tabBarStyle: {
					backgroundColor: colors.bg,
					borderTopColor: colors.border,
					minHeight: touchMin + 8
				},
				tabBarActiveTintColor: colors.accent,
				tabBarInactiveTintColor: colors.muted
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: 'Repdraft',
					tabBarLabel: ({ focused }) => <TabLabel label={tt('tab.workouts')} focused={focused} />
				}}
			/>
			<Tabs.Screen
				name="exercises"
				options={{
					title: tt('tab.exercises'),
					tabBarLabel: ({ focused }) => <TabLabel label={tt('tab.exercises')} focused={focused} />
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					title: tt('tab.profile'),
					tabBarLabel: ({ focused }) => <TabLabel label={tt('tab.profile')} focused={focused} />
				}}
			/>
		</Tabs>
	);
}
