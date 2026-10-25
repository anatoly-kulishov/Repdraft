import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from '@expo-google-fonts/inter';
import {
	Inter_400Regular,
	Inter_500Medium,
	Inter_600SemiBold,
	Inter_700Bold,
	Inter_800ExtraBold
} from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { fontFamily } from '../src/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LocaleProvider, useLocale } from '../src/state/locale';
import { ThemeProvider, useAppColors, useAppTheme } from '../src/state/theme';
import { BootSplash } from '../src/boot/BootSplash';
import { flushOutbox } from '../src/sync/cloudSync';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootStack() {
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
				// Tabs hide their header, so iOS has no previous title and shows only a chevron.
				headerBackTitle: tt('common.back'),
				headerBackButtonDisplayMode: 'generic',
				headerBackTitleStyle: { fontSize: 17, fontFamily: fontFamily.regular }
			}}
		>
			<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
			<Stack.Screen name="auth" options={{ title: tt('auth.title') }} />
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
			<Stack.Screen name="progress" options={{ title: tt('nav.progress') }} />
			<Stack.Screen name="exercise/[id]" options={{ title: tt('nav.exercise') }} />
			<Stack.Screen name="ai" options={{ title: tt('nav.ai') }} />
			<Stack.Screen name="coach" options={{ title: tt('nav.coach') }} />
		</Stack>
	);
}

export default function RootLayout() {
	const [booting, setBooting] = useState(true);
	const [fontsLoaded] = useFonts({
		Inter_400Regular,
		Inter_500Medium,
		Inter_600SemiBold,
		Inter_700Bold,
		Inter_800ExtraBold
	});

	useEffect(() => {
		void flushOutbox();
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') void flushOutbox();
		});
		return () => sub.remove();
	}, []);

	if (!fontsLoaded) {
		return <BootSplash onDone={() => undefined} />;
	}

	return (
		<GestureHandlerRootView style={styles.gestureRoot}>
			<SafeAreaProvider>
				<ThemeProvider>
					<LocaleProvider>
						<ThemedStatusBar />
						<RootStack />
						{booting ? <BootSplash onDone={() => setBooting(false)} /> : null}
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
