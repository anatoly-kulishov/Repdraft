import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
	ONBOARDING_CHECKLIST_STEPS,
	checklistProgress,
	type OnboardingChecklistStep,
	type OnboardingState
} from '@repdraft/domain/onboarding';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, touchMin, type ColorPalette } from '../theme';
import { Panel } from './Panel';
import { PrimaryButton } from './PrimaryButton';

const stepLabelKey: Record<OnboardingChecklistStep, string> = {
	homeSeen: 'onboarding.stepHome',
	planReady: 'onboarding.stepPlan',
	liveEntered: 'onboarding.stepLive',
	setLogged: 'onboarding.stepSet',
	sessionFinished: 'onboarding.stepFinish'
};

type Props = {
	state: OnboardingState;
	readonly?: boolean;
	onDismiss?: () => void;
};

export function OnboardingChecklistPanel({ state, readonly = false, onDismiss }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const progress = checklistProgress(state);
	const progressPct =
		progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

	return (
		<Panel style={styles.wrap}>
			<Text style={styles.kicker}>{tt('onboarding.checklistKicker')}</Text>
			<Text style={styles.title}>
				{tt(readonly ? 'onboarding.checklistReplayTitle' : 'onboarding.checklistTitle')}
			</Text>
			<Text style={styles.meta}>
				{tt('onboarding.checklistProgress', {
					done: String(progress.done),
					total: String(progress.total)
				})}
			</Text>
			<View style={styles.progressTrack}>
				<View style={[styles.progressFill, { width: `${progressPct}%` }]} />
			</View>
			{ONBOARDING_CHECKLIST_STEPS.map((step) => (
				<Text
					key={step}
					style={[styles.step, state.checklist[step] && styles.stepDone]}
				>
					{state.checklist[step] ? '✓ ' : '○ '}
					{tt(stepLabelKey[step])}
				</Text>
			))}
			{!readonly && onDismiss ? (
				<PrimaryButton label={tt('onboarding.dismiss')} variant="ghost" onPress={onDismiss} />
			) : null}
		</Panel>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		wrap: { gap: space.xs },
		kicker: {
			color: colors.muted,
			fontSize: 12,
			fontWeight: '700',
			textTransform: 'uppercase',
			letterSpacing: 0.6
		},
		title: { color: colors.text, fontWeight: '800', fontSize: 17 },
		meta: { color: colors.muted, fontSize: 14 },
		progressTrack: {
			height: 6,
			borderRadius: 999,
			backgroundColor: colors.bg,
			overflow: 'hidden',
			marginVertical: space.xs
		},
		progressFill: { height: '100%', backgroundColor: colors.accent },
		step: { color: colors.muted, fontSize: 14, minHeight: touchMin / 2, lineHeight: 22 },
		stepDone: { color: colors.accent }
	});
}
