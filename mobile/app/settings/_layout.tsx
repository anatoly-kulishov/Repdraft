import { Stack } from 'expo-router';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { fontFamily } from '../../src/theme';

export default function SettingsLayout() {
	const { tt } = useLocale();
	const colors = useAppColors();
	return (
		<Stack
			screenOptions={{
				headerStyle: { backgroundColor: colors.bg },
				headerTintColor: colors.text,
				headerTitleStyle: { fontWeight: '700', fontFamily: fontFamily.bold },
				contentStyle: { backgroundColor: colors.bg },
				headerShadowVisible: false,
				headerBackTitle: tt('settings.backProfile')
			}}
		>
			<Stack.Screen name="training" options={{ title: tt('settings.trainingProfileTitle') }} />
			<Stack.Screen name="workout" options={{ title: tt('settings.sessionTitle') }} />
			<Stack.Screen name="interface" options={{ title: tt('settings.interfaceTitle') }} />
			<Stack.Screen name="pro" options={{ title: tt('billing.title') }} />
			<Stack.Screen name="coach" options={{ title: tt('profile.clients') }} />
			<Stack.Screen name="progress" options={{ title: tt('progress.sectionTitle') }} />
			<Stack.Screen name="data" options={{ title: tt('settings.exportTitle') }} />
			<Stack.Screen name="account" options={{ title: tt('settings.accountTitle') }} />
		</Stack>
	);
}
