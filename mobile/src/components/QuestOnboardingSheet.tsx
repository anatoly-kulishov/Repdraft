import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
	isQuestOnboardingReady,
	parseOnboardHeightCm,
	parseOnboardWeightKg,
	type QuestHeroProfile,
	type QuestHeroSex
} from '@repdraft/domain/questHeroProfile';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';
import { AppInput } from './AppInput';
import { BottomSheet } from './BottomSheet';
import { HeroFigure } from './HeroFigure';
import { PrimaryButton } from './PrimaryButton';

type Props = {
	visible: boolean;
	defaultName?: string;
	onComplete: (profile: QuestHeroProfile) => void;
	onDismiss: () => void;
};

/** Twin of web `QuestOnboardingSheet.svelte`. */
export function QuestOnboardingSheet({ visible, defaultName, onComplete, onDismiss }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const [name, setName] = useState(defaultName ?? '');
	const [sex, setSex] = useState<QuestHeroSex | null>(null);
	const [age, setAge] = useState('');
	const [height, setHeight] = useState('');
	const [weight, setWeight] = useState('');
	const wasVisible = useRef(false);

	useEffect(() => {
		if (visible && !wasVisible.current) {
			setName(defaultName?.trim() ?? '');
			setSex(null);
			setAge('');
			setHeight('');
			setWeight('');
		}
		wasVisible.current = visible;
	}, [visible, defaultName]);

	const ready = isQuestOnboardingReady({
		displayName: name,
		sex,
		heightRaw: height,
		weightRaw: weight
	});

	function submit() {
		const heightCm = parseOnboardHeightCm(height);
		const weightKg = parseOnboardWeightKg(weight);
		if (sex !== 'm' && sex !== 'f') return;
		if (heightCm == null || weightKg == null || !name.trim()) return;
		onComplete({
			displayName: name.trim(),
			sex,
			age: age.trim() ? Math.min(99, Math.max(10, parseInt(age, 10) || 0)) : null,
			heightCm,
			weightKg,
			completedAt: new Date().toISOString()
		});
	}

	return (
		<BottomSheet
			open={visible}
			onDismiss={onDismiss}
			raised
			maxHeight="90%"
			label={tt('quest.onboardTitle')}
		>
			<Text style={styles.title}>{tt('quest.onboardTitle')}</Text>
			<Text style={styles.lead}>{tt('quest.onboardLead')}</Text>
			<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
				<View style={styles.sexRow}>
					{(['m', 'f'] as const).map((s) => (
						<Pressable
							key={s}
							accessibilityRole="button"
							accessibilityState={{ selected: sex === s }}
							accessibilityLabel={s === 'm' ? tt('quest.sexM') : tt('quest.sexF')}
							style={[styles.sexBtn, sex === s && styles.sexBtnOn]}
							onPress={() => setSex(s)}
						>
							<View pointerEvents="none">
								<HeroFigure sex={s} width={64} />
							</View>
							<Text style={[styles.sexText, sex === s && styles.sexTextOn]}>
								{s === 'm' ? tt('quest.sexM') : tt('quest.sexF')}
							</Text>
						</Pressable>
					))}
				</View>
				<AppInput
					style={styles.input}
					value={name}
					onChangeText={setName}
					placeholder={tt('quest.onboardName')}
				/>
				<AppInput
					style={styles.input}
					value={age}
					onChangeText={setAge}
					keyboardType="number-pad"
					placeholder={tt('quest.onboardAge')}
				/>
				<AppInput
					style={styles.input}
					value={height}
					onChangeText={setHeight}
					keyboardType="number-pad"
					placeholder={tt('quest.onboardHeight')}
				/>
				<AppInput
					style={styles.input}
					value={weight}
					onChangeText={setWeight}
					keyboardType="decimal-pad"
					placeholder={tt('quest.onboardWeight')}
				/>
				<Text style={styles.hint}>{tt('quest.onboardPrivacy')}</Text>
				<PrimaryButton label={tt('quest.onboardSubmit')} onPress={submit} disabled={!ready} />
			</ScrollView>
		</BottomSheet>
	);
}

/** @deprecated Use QuestOnboardingSheet */
export const QuestOnboardingModal = QuestOnboardingSheet;

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		title: { color: colors.text, fontSize: 22, fontWeight: '800', fontFamily: fontFamily.extrabold },
		lead: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: fontFamily.regular },
		form: { flexDirection: 'column', gap: space.sm, paddingVertical: space.sm, flexGrow: 0 },
		sexRow: { flexDirection: 'row', gap: space.sm },
		sexBtn: {
			flex: 1,
			minHeight: touchMin,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel,
			alignItems: 'center',
			justifyContent: 'center',
			paddingVertical: space.xs
		},
		sexBtnOn: { borderColor: colors.muscle, backgroundColor: colors.panelRaised },
		sexText: { color: colors.muted, fontWeight: '700', fontFamily: fontFamily.bold },
		sexTextOn: { color: colors.text, fontFamily: fontFamily.bold },
		input: {
			minHeight: touchMin,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel,
			color: colors.text,
			paddingHorizontal: space.md,
			fontSize: 16,
			fontFamily: fontFamily.regular
		},
		hint: {
			color: colors.muted,
			fontSize: 13,
			lineHeight: 18,
			fontFamily: fontFamily.regular,
			marginTop: space.xs,
			marginBottom: space.lg
		}
	});
}
