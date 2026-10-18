import { useMemo, useState } from 'react';
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View
} from 'react-native';
import { AppInput } from './AppInput';
import type { QuestHeroProfile, QuestHeroSex } from '@repdraft/domain/questHeroProfile';
import { useBottomChromePad } from '../layout/safe';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, touchMin, type ColorPalette } from '../theme';
import { PrimaryButton } from './PrimaryButton';

type Props = {
	visible: boolean;
	defaultName?: string;
	onComplete: (profile: QuestHeroProfile) => void;
	onSkip: () => void;
};

export function QuestOnboardingModal({ visible, defaultName, onComplete, onSkip }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const [name, setName] = useState(defaultName ?? '');
	const [sex, setSex] = useState<QuestHeroSex | null>(null);
	const [age, setAge] = useState('');
	const [height, setHeight] = useState('');
	const [weight, setWeight] = useState('');

	function submit() {
		const profile: QuestHeroProfile = {
			displayName: name.trim(),
			sex,
			age: age.trim() ? Math.min(99, Math.max(10, parseInt(age, 10) || 0)) : null,
			heightCm: height.trim() ? Math.min(250, Math.max(100, parseInt(height, 10) || 0)) : null,
			weightKg: weight.trim() ? Math.min(300, Math.max(30, parseFloat(weight.replace(',', '.')) || 0)) : null,
			completedAt: new Date().toISOString()
		};
		onComplete(profile);
	}

	return (
		<Modal visible={visible} animationType="slide" transparent onRequestClose={onSkip}>
			<KeyboardAvoidingView
				style={styles.wrap}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<Pressable style={styles.backdrop} onPress={onSkip} />
				<View style={[styles.sheet, { paddingBottom: bottomPad }]}>
					<Text style={styles.title}>{tt('quest.onboardTitle')}</Text>
					<Text style={styles.lead}>{tt('quest.onboardLead')}</Text>
					<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
						<View style={styles.sexRow}>
							{(['m', 'f'] as const).map((s) => (
								<Pressable
									key={s}
									style={[styles.sexBtn, sex === s && styles.sexBtnOn]}
									onPress={() => setSex(s)}
								>
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
					<PrimaryButton label={tt('quest.onboardSubmit')} onPress={submit} />
					<PrimaryButton label={tt('quest.onboardSkip')} variant="ghost" onPress={onSkip} />
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		wrap: { flex: 1, justifyContent: 'flex-end' },
		backdrop: {
			...StyleSheet.absoluteFill,
			backgroundColor: colors.overlayScrim
		},
		sheet: {
			backgroundColor: colors.bg,
			borderTopLeftRadius: radius.xl,
			borderTopRightRadius: radius.xl,
			padding: space.lg,
			gap: space.sm,
			maxHeight: '90%'
		},
		title: { color: colors.text, fontSize: 22, fontWeight: '800' },
		lead: { color: colors.muted, fontSize: 15, lineHeight: 21 },
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
			justifyContent: 'center'
		},
		sexBtnOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
		sexText: { color: colors.muted, fontWeight: '700' },
		sexTextOn: { color: colors.text },
		input: {
			minHeight: touchMin,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel,
			color: colors.text,
			paddingHorizontal: space.md,
			fontSize: 16
		},
		row3: { flexDirection: 'row', gap: space.sm },
		cell: { flex: 1 },
		hint: { color: colors.muted, fontSize: 13, lineHeight: 18 }
	});
}
