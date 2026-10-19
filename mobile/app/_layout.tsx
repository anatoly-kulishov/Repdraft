import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LocaleProvider, useLocale } from '../src/state/locale';
import { ThemeProvider, useAppColors, useAppTheme } from '../src/state/theme';
import { flushOutbox } from '../src/sync/cloudSync';

function RootStack() {
	const { tt } = useLocale();
	const colors = useAppColors();
	return (
		<Stack
			screenOptions={{
				headerStyle: { backgroundColor: colors.bg },
				headerTintColor: colors.text,
				headerTitleStyle: { fontWeight: '700' },
				contentStyle: { backgroundColor: colors.bg },
				headerShadowVisible: false,
				// Tabs hide their header, so iOS has no previous title and shows only a chevron.
				headerBackTitle: tt('common.back'),
				headerBackButtonDisplayMode: 'generic',
				headerBackTitleStyle: { fontSize: 17 }
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
			<Stack.Screen name="coach" options={{ title: tt('nav.coach') }} />
			<Stack.Screen name="achievements" options={{ title: tt('achievements.title') }} />
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
		<GestureHandlerRootView style={styles.gestureRoot}>
			<SafeAreaProvider>
				<ThemeProvider>
					<LocaleProvider>
						<ThemedStatusBar />
						<RootStack />
					</LocaleProvider>
				</ThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}

function ThemedStatusBar() {
	const { mode } = useAppTheme();
	return <StatusBar style={mode === 'light' ? 'dark' : 'light'} />;
}

const styles = StyleSheet.create({
	gestureRoot: { flex: 1 }
});
