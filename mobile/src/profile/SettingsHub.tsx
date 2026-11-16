import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
	BarChart3,
	CloudDownload,
	Crown,
	Home,
	Languages,
	Shield,
	Smartphone,
	Users
} from 'lucide-react-native';
import type { AthleteProfile } from '@repdraft/domain/athleteProfile';
import { getAthleteProfile } from '../state/prefs';
import { useLocale } from '../state/locale';
import { useAppTheme } from '../state/theme';
import { space } from '../theme';
import { SettingsGroup } from './SettingsGroup';
import { SettingsRow } from './SettingsRow';

type Props = {
	signedIn: boolean;
	showPro?: boolean;
	showCoach?: boolean;
	showWorkout?: boolean;
};

export function SettingsHub({
	signedIn,
	showPro = true,
	showCoach = false,
	showWorkout = true
}: Props) {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const { mode } = useAppTheme();
	const [athlete, setAthlete] = useState<AthleteProfile | null>(null);

	useFocusEffect(
		useCallback(() => {
			void getAthleteProfile().then(setAthlete);
		}, [])
	);

	const placeValue = useMemo(
		() => tt(athlete?.trainingPlace === 'home' ? 'place.home' : 'place.gym'),
		[athlete?.trainingPlace, tt]
	);
	const interfaceValue = useMemo(
		() =>
			[
				locale === 'ru' ? 'RU' : 'EN',
				tt(mode === 'light' ? 'settings.themeLight' : 'settings.themeDark')
			].join(', '),
		[locale, mode, tt]
	);

	return (
		<View style={{ gap: space.md }}>
			<SettingsGroup label={tt('settings.group.account')}>
				{showPro && signedIn ? (
					<SettingsRow
						icon={Crown}
						label={tt('billing.title')}
						onPress={() => router.push('/settings/pro')}
					/>
				) : null}
				<SettingsRow
					icon={Home}
					label={tt('settings.trainingProfileTitle')}
					value={placeValue}
					onPress={() => router.push('/settings/training')}
				/>
				{showCoach && signedIn ? (
					<SettingsRow
						icon={Users}
						label={tt('profile.clients')}
						onPress={() => router.push('/settings/coach')}
					/>
				) : null}
				{signedIn ? (
					<SettingsRow
						icon={Shield}
						label={tt('settings.accountTitle')}
						onPress={() => router.push('/settings/account')}
					/>
				) : null}
			</SettingsGroup>

			<SettingsGroup label={tt('settings.group.preferences')}>
				{showWorkout ? (
					<SettingsRow
						icon={Smartphone}
						label={tt('settings.sessionTitle')}
						onPress={() => router.push('/settings/workout')}
					/>
				) : null}
				<SettingsRow
					icon={Languages}
					label={tt('settings.interfaceTitle')}
					value={interfaceValue}
					onPress={() => router.push('/settings/interface')}
				/>
				<SettingsRow
					icon={BarChart3}
					label={tt('progress.sectionTitle')}
					onPress={() => router.push('/settings/progress')}
				/>
			</SettingsGroup>

			<SettingsGroup label={tt('settings.group.support')}>
				<SettingsRow
					icon={CloudDownload}
					label={tt('settings.exportTitle')}
					onPress={() => router.push('/settings/data')}
				/>
			</SettingsGroup>
		</View>
	);
}
