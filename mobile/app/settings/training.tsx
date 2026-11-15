import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ClipboardList, Dumbbell, Home } from 'lucide-react-native';
import type { AthleteProfile } from '@repdraft/domain/athleteProfile';
import { formatHomeKitSummary, type HomeKitOptionalId } from '@repdraft/domain/homeKit';
import { HomeKitSheet } from '../../src/components/HomeKitSheet';
import { IntakeStepper } from '../../src/components/IntakeStepper';
import { SettingsGroup } from '../../src/profile/SettingsGroup';
import { SettingsRow } from '../../src/profile/SettingsRow';
import { useLocale } from '../../src/state/locale';
import {
	getAthleteProfile,
	getHomeKitSelection,
	setAthleteProfile
} from '../../src/state/prefs';
import { useAppColors } from '../../src/state/theme';
import { space } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';

export default function SettingsTrainingScreen() {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors.bg), [colors.bg]);
	const bottomPad = useBottomChromePad(space.lg);
	const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
	const [homeKit, setHomeKit] = useState<HomeKitOptionalId[]>([]);
	const [homeKitOpen, setHomeKitOpen] = useState(false);
	const [intakeOpen, setIntakeOpen] = useState(false);
	const homeKitSummary = useMemo(
		() =>
			formatHomeKitSummary(
				homeKit,
				(id) => tt(`homeKit.group.${id}`),
				tt('homeKit.empty')
			),
		[homeKit, tt]
	);

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				setAthlete(await getAthleteProfile());
				setHomeKit(await getHomeKitSelection());
			})();
		}, [])
	);

	return (
		<>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
			>
				<SettingsGroup hint={tt('place.hint')}>
					<SettingsRow
						icon={Home}
						label={tt('place.row')}
						value={tt(athlete?.trainingPlace === 'home' ? 'place.home' : 'place.gym')}
						onPress={() => {
							void (async () => {
								const base = athlete ?? (await getAthleteProfile());
								const nextPlace = base.trainingPlace === 'home' ? 'gym' : 'home';
								const next = { ...base, trainingPlace: nextPlace as 'gym' | 'home' };
								await setAthleteProfile(next);
								setAthlete(next);
							})();
						}}
					/>
					{athlete?.trainingPlace === 'home' ? (
						<SettingsRow
							icon={Dumbbell}
							label={tt('homeKit.row')}
							value={homeKitSummary}
							onPress={() => setHomeKitOpen(true)}
						/>
					) : null}
					<SettingsRow
						icon={ClipboardList}
						label={tt('intake.profileRow')}
						value={
							athlete?.intakeCompletedAt ? tt('intake.profileDone') : tt('intake.profileEmpty')
						}
						accessibilityLabel={tt('intake.profileEdit')}
						onPress={() => setIntakeOpen(true)}
					/>
				</SettingsGroup>
			</ScrollView>
			<HomeKitSheet
				open={homeKitOpen}
				onDismiss={() => setHomeKitOpen(false)}
				onSaved={setHomeKit}
			/>
			<IntakeStepper
				open={intakeOpen}
				mode="edit"
				onFinished={() => {
					setIntakeOpen(false);
					void getAthleteProfile().then(setAthlete);
					void getHomeKitSelection().then(setHomeKit);
				}}
			/>
		</>
	);
}

function makeStyles(bg: string) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: bg },
		root: { padding: space.lg, gap: space.md }
	});
}
