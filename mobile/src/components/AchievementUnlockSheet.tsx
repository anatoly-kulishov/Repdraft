import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { achievementTitleKey, type AchievementId } from '@repdraft/domain/achievements';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { type ColorPalette } from '../theme';
import { BottomSheet } from './BottomSheet';
import { PrimaryButton } from './PrimaryButton';

type Props = {
	ids: AchievementId[] | null;
	onClose: () => void;
};

/** Twin of web `AchievementUnlockSheet.svelte` (bottom sheet, not centered modal). */
export function AchievementUnlockSheet({ ids, onClose }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const open = Boolean(ids && ids.length > 0);

	return (
		<BottomSheet
			open={open}
			onDismiss={onClose}
			label={tt('achievements.newUnlock')}
			actions={<PrimaryButton label={tt('achievements.viewAll')} onPress={onClose} />}
		>
			<Text style={styles.kicker}>{tt('achievements.newUnlock')}</Text>
			{(ids ?? []).map((id) => (
				<Text key={id} style={styles.title}>
					{tt(achievementTitleKey(id))}
				</Text>
			))}
		</BottomSheet>
	);
}

/** @deprecated Use AchievementUnlockSheet */
export const AchievementUnlockModal = AchievementUnlockSheet;

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		kicker: {
			color: colors.accent,
			fontWeight: '800',
			fontSize: 12,
			letterSpacing: 0.8,
			textTransform: 'uppercase'
		},
		title: { color: colors.text, fontSize: 20, fontWeight: '800' }
	});
}
