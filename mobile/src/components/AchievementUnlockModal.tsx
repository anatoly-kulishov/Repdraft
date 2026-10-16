import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import {
	achievementTitleKey,
	type AchievementId
} from '@repdraft/domain/achievements';
import { useBottomChromePad } from '../layout/safe';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, touchMin, type ColorPalette } from '../theme';
import { PrimaryButton } from './PrimaryButton';

type Props = {
	ids: AchievementId[] | null;
	onClose: () => void;
};

export function AchievementUnlockModal({ ids, onClose }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.md);
	const open = Boolean(ids && ids.length > 0);

	if (!open || !ids) return null;

	return (
		<Modal visible={open} animationType="fade" transparent onRequestClose={onClose}>
			<View style={styles.wrap}>
				<Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
				<View style={[styles.card, { paddingBottom: bottomPad }]}>
					<Text style={styles.kicker}>{tt('achievements.newUnlock')}</Text>
					{ids.map((id) => (
						<Text key={id} style={styles.title}>
							{tt(achievementTitleKey(id))}
						</Text>
					))}
					<PrimaryButton label={tt('achievements.viewAll')} onPress={onClose} />
				</View>
			</View>
		</Modal>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		wrap: { flex: 1, justifyContent: 'center', padding: space.lg },
		backdrop: {
			...StyleSheet.absoluteFill,
			backgroundColor: colors.overlayScrim
		},
		card: {
			backgroundColor: colors.panel,
			borderRadius: radius.xl,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.lg,
			gap: space.sm,
			minHeight: touchMin * 2
		},
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
