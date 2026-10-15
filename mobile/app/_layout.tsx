import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { LocaleProvider, useLocale } from '../src/state/locale';
import { flushOutbox } from '../src/sync/cloudSync';
import { colors } from '../src/theme';

function RootStack() {
	const { tt } = useLocale();
	return (
		<Stack
			screenOptions={{
				headerStyle: { backgroundColor: colors.bg },
				headerTintColor: colors.text,
				headerTitleStyle: { fontWeight: '700' },
				contentStyle: { backgroundColor: colors.bg },
				headerShadowVisible: false
			}}
		>
			<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
			<Stack.Screen name="plan/[id]" options={{ title: tt('nav.preview') }} />
			<Stack.Screen
				name="live/[planId]"
				options={{ title: tt('nav.live'), headerBackVisible: false }}
			/>
			<Stack.Screen name="summary/[id]" options={{ title: tt('nav.summary') }} />
			<Stack.Screen name="history/index" options={{ title: tt('nav.history') }} />
			<Stack.Screen name="history/[id]" options={{ title: tt('nav.session') }} />
			<Stack.Screen name="builder/[planId]" options={{ title: tt('nav.builder') }} />
			<Stack.Screen name="records" options={{ title: tt('nav.records') }} />
			<Stack.Screen name="exercise/[id]" options={{ title: tt('nav.exercise') }} />
			<Stack.Screen name="ai" options={{ title: tt('nav.ai') }} />
		</Stack>
	);
}

export default function RootLayout() {
	useEffect(() => {
		void flushOutbox();
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') void flushOutbox();
		});
		return () => sub.remove();
	}, []);

	return (
		<LocaleProvider>
			<StatusBar style="light" />
			<RootStack />
		</LocaleProvider>
	);
}
