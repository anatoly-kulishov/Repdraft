import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { achievementTitleKey, type AchievementId } from '@repdraft/domain/achievements';
import type { QuestHeroProfile } from '@repdraft/domain/questHeroProfile';
import { useLocale } from '../state/locale';
import { loadQuestHeroProfile } from '../state/questHero';
import { useAppColors } from '../state/theme';
import { fontFamily, type ColorPalette } from '../theme';
import { AchievementGlyph } from './AchievementGlyph';
import { BottomSheet } from './BottomSheet';
import { HeroFigure } from './HeroFigure';
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
	const [profile, setProfile] = useState<QuestHeroProfile | null>(null);

	useEffect(() => {
		if (!open) return;
		void loadQuestHeroProfile().then(setProfile);
	}, [open]);

	return (
		<BottomSheet
			open={open}
			onDismiss={onClose}
			label={tt('achievements.newUnlock')}
			actions={<PrimaryButton label={tt('achievements.viewAll')} onPress={onClose} />}
		>
			<HeroFigure sex={profile?.sex ?? null} width={72} />
			<Text style={styles.kicker}>{tt('achievements.newUnlock')}</Text>
			{(ids ?? []).map((id) => (
				<View key={id} style={styles.row}>
					<AchievementGlyph id={id} />
					<Text style={styles.title}>{tt(achievementTitleKey(id))}</Text>
				</View>
			))}
		</BottomSheet>
	);
}

/** @deprecated Use AchievementUnlockSheet */
export const AchievementUnlockModal = AchievementUnlockSheet;

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		kicker: {
			color: colors.text,
			fontWeight: '800',
			fontSize: 18,
			fontFamily: fontFamily.extrabold
		},
		row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
		title: {
			color: colors.text,
			fontSize: 16,
			fontWeight: '600',
			flex: 1,
			fontFamily: fontFamily.semibold
		}
	});
}
