import AsyncStorage from '@react-native-async-storage/async-storage';
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode
} from 'react';
import {
	darkPalette,
	lightPalette,
	type AppThemeMode,
	type ColorPalette
} from '../theme/palettes';

const KEY = 'repdraft:theme';

type ThemeCtx = {
	mode: AppThemeMode;
	colors: ColorPalette;
	setMode: (mode: AppThemeMode) => void;
	cycleMode: () => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [mode, setModeState] = useState<AppThemeMode>('dark');

	useEffect(() => {
		void AsyncStorage.getItem(KEY).then((raw) => {
			if (raw === 'light' || raw === 'dark') setModeState(raw);
		});
	}, []);

	const setMode = useCallback((next: AppThemeMode) => {
		setModeState(next);
		void AsyncStorage.setItem(KEY, next);
	}, []);

	const cycleMode = useCallback(() => {
		setMode(mode === 'dark' ? 'light' : 'dark');
	}, [mode, setMode]);

	const value = useMemo(
		() => ({
			mode,
			colors: mode === 'light' ? lightPalette : darkPalette,
			setMode,
			cycleMode
		}),
		[mode, setMode, cycleMode]
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeCtx {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error('useAppTheme outside ThemeProvider');
	return ctx;
}

export function useAppColors(): ColorPalette {
	return useAppTheme().colors;
}
