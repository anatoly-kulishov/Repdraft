import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ClipboardList, Dumbbell, Home, Pencil } from 'lucide-react-native';
import type { AthleteProfile } from '@repdraft/domain/athleteProfile';
import type { HomeKitOptionalId } from '@repdraft/domain/homeKit';
import { HomeKitSheet } from '../../src/components/HomeKitSheet';
import { IntakeStepper } from '../../src/components/IntakeStepper';
import { useLocale } from '../../src/state/locale';
import {
	getAthleteProfile,
	getHomeKitSelection,
	setAthleteProfile
} from '../../src/state/prefs';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../../src/theme';
import { useBottomChromePad } from '../../src/layout/safe';

export default function SettingsTrainingScreen() {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
	const [homeKit, setHomeKit] = useState<HomeKitOptionalId[]>([]);
	const [homeKitOpen, setHomeKitOpen] = useState(false);
	const [intakeOpen, setIntakeOpen] = useState(false);

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
				<Pressable
					style={styles.row}
					onPress={() => {
						void (async () => {
							const base = athlete ?? (await getAthleteProfile());
							const nextPlace = base.trainingPlace === 'home' ? 'gym' : 'home';
							const next = { ...base, trainingPlace: nextPlace as 'gym' | 'home' };
							await setAthleteProfile(next);
							setAthlete(next);
						})();
					}}
					accessibilityRole="button"
				>
					<Home color={colors.text} size={18} strokeWidth={2} />
					<View style={styles.rowBody}>
						<Text style={styles.rowText}>{tt('place.row')}</Text>
						<Text style={styles.hint} numberOfLines={1}>
							{tt(athlete?.trainingPlace === 'home' ? 'place.home' : 'place.gym')}
						</Text>
					</View>
				</Pressable>
				{athlete?.trainingPlace === 'home' ? (
					<Pressable
						style={styles.row}
						onPress={() => setHomeKitOpen(true)}
						accessibilityRole="button"
					>
						<Dumbbell color={colors.text} size={18} strokeWidth={2} />
						<View style={styles.rowBody}>
							<Text style={styles.rowText}>{tt('homeKit.row')}</Text>
							<Text style={styles.hint} numberOfLines={2}>
								{homeKit.length === 0
									? tt('homeKit.empty')
									: homeKit.map((id) => tt(`homeKit.group.${id}`)).join(', ')}
							</Text>
						</View>
					</Pressable>
				) : null}
				<Pressable
					style={styles.row}
					onPress={() => setIntakeOpen(true)}
					accessibilityRole="button"
					accessibilityLabel={tt('intake.profileEdit')}
				>
					<ClipboardList color={colors.text} size={18} strokeWidth={2} />
					<View style={styles.rowBody}>
						<Text style={styles.rowText}>{tt('intake.profileRow')}</Text>
						<Text style={styles.hint} numberOfLines={1}>
							{athlete?.intakeCompletedAt ? tt('intake.profileDone') : tt('intake.profileEmpty')}
						</Text>
					</View>
					<Pencil color={colors.accent} size={20} strokeWidth={2.25} />
				</Pressable>
				<Text style={styles.hint}>{tt('place.hint')}</Text>
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

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: 8 },
		row: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			gap: 10,
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: 12,
			paddingHorizontal: 12,
			backgroundColor: colors.panel
		},
		rowBody: { flex: 1, minWidth: 0 },
		rowText: { fontFamily: fontFamily.medium, fontSize: 15, color: colors.text },
		hint: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.muted, marginTop: 2 }
	});
}
