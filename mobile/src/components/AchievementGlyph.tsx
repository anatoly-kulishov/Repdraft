import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Flame, Medal, Target, Trophy, Zap } from 'lucide-react-native';
import { achievementGlyph, type AchievementId, type AchievementIconName } from '@repdraft/domain/achievements';

const ICONS = {
	flame: Flame,
	medal: Medal,
	trophy: Trophy,
	target: Target,
	zap: Zap
} as const satisfies Record<AchievementIconName, typeof Flame>;

type Props = {
	id: AchievementId;
	size?: number;
	dim?: boolean;
};

export function AchievementGlyph({ id, size = 36, dim = false }: Props) {
	const spec = achievementGlyph(id);
	const Icon = ICONS[spec.icon];
	const styles = useMemo(
		() =>
			StyleSheet.create({
				plate: {
					width: size,
					height: size,
					borderRadius: size / 2,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: spec.color,
					opacity: dim ? 0.42 : 1
				}
			}),
		[dim, size, spec.color]
	);

	return (
		<View style={styles.plate}>
			<Icon color="#fff" size={Math.round(size * 0.52)} strokeWidth={2.25} />
		</View>
	);
}
