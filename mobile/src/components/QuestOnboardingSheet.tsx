import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { QuestHeroProfile, QuestHeroSex } from '@repdraft/domain/questHeroProfile';
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

function parseHeight(raw: string): number | null {
	if (!raw.trim()) return null;
	const n = parseInt(raw, 10);
	if (!Number.isFinite(n)) return null;
	return Math.min(250, Math.max(100, n));
}

function parseWeight(raw: string): number | null {
	if (!raw.trim()) return null;
	const n = parseFloat(raw.replace(',', '.'));
	if (!Number.isFinite(n)) return null;
	return Math.min(300, Math.max(30, n));
}

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
	const heightCm = parseHeight(height);
	const weightKg = parseWeight(weight);
	const ready = name.trim().length > 0 && (sex === 'm' || sex === 'f') && heightCm != null && weightKg != null;

	function submit() {
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
			actions={<PrimaryButton label={tt('quest.onboardSubmit')} onPress={submit} disabled={!ready} />}
		>
			<Text style={styles.title}>{tt('quest.onboardTitle')}</Text>
			<Text style={styles.lead}>{tt('quest.onboardLead')}</Text>
			<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
				<View style={styles.sexRow}>
					{(['m', 'f'] as const).map((s) => (
						<Pressable
							key={s}
							accessibilityRole="button"
							accessibilityLabel={s === 'm' ? tt('quest.sexM') : tt('quest.sexF')}
							style={[styles.sexBtn, sex === s && styles.sexBtnOn]}
							onPress={() => setSex(s)}
						>
							<HeroFigure sex={s} width={64} />
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
				<View style={styles.row3}>
					<AppInput
						style={[styles.input, styles.cell]}
						value={age}
						onChangeText={setAge}
						keyboardType="number-pad"
						placeholder={tt('quest.onboardAge')}
					/>
					<AppInput
						style={[styles.input, styles.cell]}
						value={height}
						onChangeText={setHeight}
						keyboardType="number-pad"
						placeholder={tt('quest.onboardHeight')}
					/>
					<AppInput
						style={[styles.input, styles.cell]}
						value={weight}
						onChangeText={setWeight}
						keyboardType="decimal-pad"
						placeholder={tt('quest.onboardWeight')}
					/>
				</View>
				<Text style={styles.hint}>{tt('quest.onboardPrivacy')}</Text>
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
		form: { gap: space.sm, paddingVertical: space.sm },
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
		sexBtnOn: { borderColor: colors.muscle },
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
		row3: { flexDirection: 'row', gap: space.sm },
		cell: { flex: 1 },
		hint: { color: colors.muted, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular }
	});
}
