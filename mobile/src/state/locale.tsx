import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { t, type Locale } from '@repdraft/i18n/messages';

const KEY = 'repdraft:locale';

type Ctx = {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	tt: (key: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<Ctx | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<Locale>('ru');

	useEffect(() => {
		void AsyncStorage.getItem(KEY).then((raw) => {
			if (raw === 'en' || raw === 'ru') setLocaleState(raw);
		});
	}, []);

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next);
		void AsyncStorage.setItem(KEY, next);
	}, []);

	const value = useMemo(
		() => ({
			locale,
			setLocale,
			tt: (key: string, vars?: Record<string, string | number>) => t(locale, key, vars)
		}),
		[locale, setLocale]
	);

	return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Ctx {
	const ctx = useContext(LocaleContext);
	if (!ctx) throw new Error('useLocale outside provider');
	return ctx;
}
