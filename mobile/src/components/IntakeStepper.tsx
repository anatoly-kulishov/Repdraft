import { useEffect, useMemo, useState } from 'react';
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	View
} from 'react-native';
import {
	ATHLETE_DAYS_OPTIONS,
	ATHLETE_EXPERIENCE_IDS,
	ATHLETE_GOAL_IDS,
	ATHLETE_LIMIT_IDS,
	ATHLETE_SESSION_MINUTES_OPTIONS,
	defaultAthleteProfile,
	intakeStepsForPlace,
	markIntakeComplete,
	skipIntakeProfile,
	toggleAthleteGoal,
	toggleAthleteLimit,
	type AthleteExperience,
	type AthleteGoalId,
	type AthleteLimitId,
	type AthleteProfile,
	type IntakeStepId,
	type TrainingPlace
} from '@repdraft/domain/athleteProfile';
import {
	HOME_KIT_OPTIONAL_GROUPS,
	type HomeKitOptionalId
} from '@repdraft/domain/homeKit';
import { ArrowLeft, Check, X } from 'lucide-react-native';
import { BottomSheet } from './BottomSheet';
import { PrimaryButton } from './PrimaryButton';
import { useLocale } from '../state/locale';
import {
	getAthleteProfile,
	getHomeKitSelection,
	setAthleteProfile,
	setHomeKitSelection
} from '../state/prefs';
import { useAppColors } from '../state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	open: boolean;
	mode?: 'first' | 'edit';
	onFinished?: () => void;
};

function parseOptionalInt(raw: string, min: number, max: number): number | null {
	const t = raw.trim();
	if (!t) return null;
	const n = Math.round(Number(t.replace(',', '.')));
	if (!Number.isFinite(n) || n < min || n > max) return null;
	return n;
}

export function IntakeStepper({ open, mode = 'first', onFinished }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const [draft, setDraft] = useState<AthleteProfile>(defaultAthleteProfile());
	const [kitDraft, setKitDraft] = useState<HomeKitOptionalId[]>([]);
	const [stepIndex, setStepIndex] = useState(0);
	const [heightText, setHeightText] = useState('');
	const [weightText, setWeightText] = useState('');

	const steps = intakeStepsForPlace(draft.trainingPlace);
	const step = steps[Math.min(stepIndex, steps.length - 1)] ?? 'goals';
	const isLast = stepIndex >= steps.length - 1;
	const progressPct = Math.round(((stepIndex + 1) / Math.max(steps.length, 1)) * 100);

	useEffect(() => {
		if (!open) return;
		void (async () => {
			const profile = await getAthleteProfile();
			const kit = await getHomeKitSelection();
			setDraft({ ...profile, intakeCompletedAt: null });
			setKitDraft(kit);
			setHeightText(profile.heightCm != null ? String(profile.heightCm) : '');
			setWeightText(profile.weightKg != null ? String(profile.weightKg) : '');
			setStepIndex(0);
		})();
	}, [open]);

	useEffect(() => {
		if (stepIndex > steps.length - 1) setStepIndex(steps.length - 1);
	}, [steps.length, stepIndex]);

	function applyBody(profile: AthleteProfile): AthleteProfile {
		return {
			...profile,
			heightCm: parseOptionalInt(heightText, 100, 250),
			weightKg: parseOptionalInt(weightText, 30, 300)
		};
	}

	async function finish(profile: AthleteProfile) {
		const next = markIntakeComplete(applyBody(profile));
		if (next.trainingPlace === 'home') {
			await setHomeKitSelection(kitDraft);
		}
		await setAthleteProfile(next);
		onFinished?.();
	}

	async function skip() {
		if (mode === 'first') {
			await setAthleteProfile(skipIntakeProfile());
		}
		onFinished?.();
	}

	function stepTitle(id: IntakeStepId): string {
		switch (id) {
			case 'goals':
				return tt('intake.goalsTitle');
			case 'place':
				return tt('intake.placeTitle');
			case 'kit':
				return tt('intake.kitTitle');
			case 'body':
				return tt('intake.bodyTitle');
			case 'rhythm':
				return tt('intake.rhythmTitle');
			case 'limits':
				return tt('intake.limitsTitle');
			default: {
				const _exhaustive: never = id;
				return _exhaustive;
			}
		}
	}

	function stepHint(id: IntakeStepId): string {
		switch (id) {
			case 'goals':
				return tt('intake.goalsHint');
			case 'place':
				return tt('intake.placeHint');
			case 'kit':
				return tt('intake.kitHint');
			case 'body':
				return tt('intake.bodyHint');
			case 'rhythm':
				return tt('intake.rhythmHint');
			case 'limits':
				return tt('intake.limitsHint');
			default: {
				const _exhaustive: never = id;
				return _exhaustive;
			}
		}
	}

	function OptionRow({
		label,
		active,
		onPress
	}: {
		label: string;
		active: boolean;
		onPress: () => void;
	}) {
		return (
			<Pressable
				onPress={onPress}
				style={[styles.option, active && styles.optionActive]}
				accessibilityRole="button"
				accessibilityState={{ selected: active }}
			>
				<Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
				{active ? <Check size={18} color={colors.accentText} strokeWidth={2.5} /> : null}
			</Pressable>
		);
	}

	return (
		<BottomSheet
			open={open}
			onDismiss={() => {
				void skip();
			}}
			label={tt('intake.title')}
			maxHeight="90%"
		>
			<View style={styles.toolbar}>
				{stepIndex > 0 ? (
					<Pressable
						onPress={() => setStepIndex((i) => Math.max(0, i - 1))}
						style={styles.toolBtn}
						accessibilityRole="button"
						accessibilityLabel={tt('intake.back')}
					>
						<ArrowLeft size={20} color={colors.text} strokeWidth={2.25} />
					</Pressable>
				) : (
					<View style={styles.toolSlot} />
				)}
				<Text style={styles.stepLabel}>
					{tt('intake.stepProgress', { current: stepIndex + 1, total: steps.length })}
				</Text>
				<Pressable
					onPress={() => void skip()}
					style={styles.toolBtn}
					accessibilityRole="button"
					accessibilityLabel={tt('intake.skip')}
				>
					<X size={20} color={colors.muted} strokeWidth={2.25} />
				</Pressable>
			</View>
			<View style={styles.progressTrack}>
				<View style={[styles.progressFill, { width: `${progressPct}%` }]} />
			</View>
			<Text style={styles.title}>{stepTitle(step)}</Text>
			<Text style={styles.hint}>{stepHint(step)}</Text>

			<ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
				{step === 'goals' ? (
					<View style={styles.options}>
						{ATHLETE_GOAL_IDS.map((id) => (
							<OptionRow
								key={id}
								label={tt(`intake.goal.${id}`)}
								active={draft.goals.includes(id)}
								onPress={() =>
									setDraft((prev) => ({
										...prev,
										goals: toggleAthleteGoal(prev.goals, id as AthleteGoalId)
									}))
								}
							/>
						))}
					</View>
				) : null}

				{step === 'place' ? (
					<View style={styles.options}>
						{(['gym', 'home'] as TrainingPlace[]).map((place) => (
							<OptionRow
								key={place}
								label={tt(`place.${place}`)}
								active={draft.trainingPlace === place}
								onPress={() => setDraft((prev) => ({ ...prev, trainingPlace: place }))}
							/>
						))}
					</View>
				) : null}

				{step === 'kit' ? (
					<View style={styles.list}>
						<View style={[styles.row, styles.rowLocked]}>
							<Text style={[styles.rowText, styles.rowMuted]}>
								{tt('homeKit.group.bodyweight')}
							</Text>
							<Switch value disabled trackColor={{ false: colors.border, true: colors.accent }} />
						</View>
						{HOME_KIT_OPTIONAL_GROUPS.map((id) => (
							<Pressable
								key={id}
								style={styles.row}
								onPress={() =>
									setKitDraft((prev) =>
										prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
									)
								}
							>
								<Text style={styles.rowText}>{tt(`homeKit.group.${id}`)}</Text>
								<Switch
									value={kitDraft.includes(id)}
									onValueChange={() =>
										setKitDraft((prev) =>
											prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
										)
									}
									trackColor={{ false: colors.border, true: colors.accent }}
								/>
							</Pressable>
						))}
					</View>
				) : null}

				{step === 'body' ? (
					<View style={styles.fieldsRow}>
						<View style={styles.field}>
							<Text style={styles.fieldLabel}>{tt('intake.height')}</Text>
							<TextInput
								style={styles.input}
								value={heightText}
								onChangeText={setHeightText}
								keyboardType="number-pad"
								placeholder="-"
								placeholderTextColor={colors.muted}
							/>
						</View>
						<View style={styles.field}>
							<Text style={styles.fieldLabel}>{tt('intake.weight')}</Text>
							<TextInput
								style={styles.input}
								value={weightText}
								onChangeText={setWeightText}
								keyboardType="decimal-pad"
								placeholder="-"
								placeholderTextColor={colors.muted}
							/>
						</View>
					</View>
				) : null}

				{step === 'rhythm' ? (
					<View style={styles.sections}>
						<Text style={styles.sub}>{tt('intake.rhythmTitle')}</Text>
						<View style={styles.options}>
							{ATHLETE_EXPERIENCE_IDS.map((id) => (
								<OptionRow
									key={id}
									label={tt(`intake.experience.${id}`)}
									active={draft.experience === id}
									onPress={() =>
										setDraft((prev) => ({
											...prev,
											experience: id as AthleteExperience
										}))
									}
								/>
							))}
						</View>
						<Text style={styles.sub}>{tt('intake.days')}</Text>
						<View style={styles.grid}>
							{ATHLETE_DAYS_OPTIONS.map((n) => (
								<Pressable
									key={n}
									style={[styles.gridCell, draft.daysPerWeek === n && styles.gridCellActive]}
									onPress={() => setDraft((prev) => ({ ...prev, daysPerWeek: n }))}
								>
									<Text
										style={[
											styles.gridCellText,
											draft.daysPerWeek === n && styles.gridCellTextActive
										]}
									>
										{n}
									</Text>
								</Pressable>
							))}
						</View>
						<Text style={styles.sub}>{tt('intake.minutes')}</Text>
						<View style={styles.grid}>
							{ATHLETE_SESSION_MINUTES_OPTIONS.map((n) => (
								<Pressable
									key={n}
									style={[
										styles.gridCell,
										draft.sessionMinutes === n && styles.gridCellActive
									]}
									onPress={() => setDraft((prev) => ({ ...prev, sessionMinutes: n }))}
								>
									<Text
										style={[
											styles.gridCellText,
											draft.sessionMinutes === n && styles.gridCellTextActive
										]}
									>
										{n}
									</Text>
								</Pressable>
							))}
						</View>
					</View>
				) : null}

				{step === 'limits' ? (
					<View style={styles.options}>
						{ATHLETE_LIMIT_IDS.map((id) => (
							<OptionRow
								key={id}
								label={tt(`intake.limit.${id}`)}
								active={draft.limits.includes(id)}
								onPress={() =>
									setDraft((prev) => ({
										...prev,
										limits: toggleAthleteLimit(prev.limits, id as AthleteLimitId)
									}))
								}
							/>
						))}
					</View>
				) : null}
			</ScrollView>

			<View style={styles.actions}>
				<PrimaryButton
					label={isLast ? tt('intake.finish') : tt('intake.next')}
					onPress={() => {
						if (isLast) void finish(draft);
						else setStepIndex((i) => i + 1);
					}}
				/>
			</View>
		</BottomSheet>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		toolbar: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			minHeight: touchMin,
			marginBottom: 8
		},
		toolBtn: {
			width: touchMin,
			height: touchMin,
			alignItems: 'center',
			justifyContent: 'center'
		},
		toolSlot: { width: touchMin, height: touchMin },
		stepLabel: {
			flex: 1,
			textAlign: 'center',
			fontFamily: fontFamily.medium,
			fontSize: 13,
			color: colors.muted
		},
		title: {
			fontFamily: fontFamily.bold,
			fontSize: 22,
			color: colors.text,
			marginBottom: 6
		},
		hint: {
			fontFamily: fontFamily.regular,
			fontSize: 14,
			color: colors.muted,
			lineHeight: 20,
			marginBottom: 10
		},
		progressTrack: {
			height: 4,
			borderRadius: 999,
			backgroundColor: colors.border,
			overflow: 'hidden',
			marginBottom: space.md
		},
		progressFill: {
			height: '100%',
			borderRadius: 999,
			backgroundColor: colors.accent
		},
		scroll: { maxHeight: 420 },
		scrollContent: { gap: space.sm, paddingBottom: space.sm },
		options: { gap: 8 },
		option: {
			minHeight: touchMin,
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: 12,
			paddingHorizontal: 14,
			paddingVertical: 12,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			backgroundColor: colors.panel
		},
		optionActive: {
			borderColor: colors.accent,
			backgroundColor: colors.panelRaised
		},
		optionText: {
			fontFamily: fontFamily.medium,
			fontSize: 15,
			color: colors.text,
			flex: 1
		},
		optionTextActive: {
			color: colors.accentText,
			fontFamily: fontFamily.bold
		},
		list: { gap: 4 },
		row: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: space.sm
		},
		rowLocked: {
			opacity: 0.75,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: colors.border,
			paddingBottom: 8,
			marginBottom: 4
		},
		rowText: { fontFamily: fontFamily.medium, fontSize: 15, color: colors.text, flex: 1 },
		rowMuted: { color: colors.muted },
		fieldsRow: { flexDirection: 'column', gap: 10 },
		field: { width: '100%', gap: 6 },
		fieldLabel: {
			fontFamily: fontFamily.medium,
			fontSize: 12,
			color: colors.muted,
			textTransform: 'uppercase',
			letterSpacing: 0.4
		},
		input: {
			minHeight: touchMin,
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: 12,
			paddingHorizontal: space.md,
			color: colors.text,
			fontFamily: fontFamily.bold,
			fontSize: 17,
			backgroundColor: colors.panel
		},
		sections: { gap: 10 },
		sub: {
			fontFamily: fontFamily.medium,
			fontSize: 12,
			color: colors.muted,
			textTransform: 'uppercase',
			letterSpacing: 0.4,
			marginTop: 4
		},
		grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
		gridCell: {
			minHeight: touchMin,
			minWidth: 56,
			flexGrow: 1,
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: 12,
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: colors.panel
		},
		gridCellActive: {
			borderColor: colors.accent,
			backgroundColor: colors.panelRaised
		},
		gridCellText: {
			fontFamily: fontFamily.bold,
			fontSize: 15,
			color: colors.text
		},
		gridCellTextActive: { color: colors.accentText },
		actions: { marginTop: space.md }
	});
}
