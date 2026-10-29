import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import type { ExerciseIndexItem } from '@repdraft/domain/types';
import { exerciseDisplayName } from '../catalog/loadIndex';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../theme';
import { CatalogThumb } from './CatalogThumb';

type Props = {
	title: string;
	items: ExerciseIndexItem[];
	onPress: (item: ExerciseIndexItem) => void;
	/** Builder pick mode: show a "+" affordance and add on tap. */
	pickMode?: boolean;
};

/** Horizontal "Часто тренируете" chips under the Exercises hub grid. */
export function FrequentExercisesRail({ title, items, onPress, pickMode }: Props) {
	const { locale } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	if (items.length === 0) return null;

	return (
		<View style={styles.wrap}>
			<Text style={styles.title}>{title}</Text>
			<View style={styles.railWrap}>
				<FlatList
					horizontal
					data={items}
					keyExtractor={(item) => item.id}
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.rail}
					renderItem={({ item }) => (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={exerciseDisplayName(item.id, locale)}
							onPress={() => onPress(item)}
							style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
						>
							<CatalogThumb
								imagePath={item.image}
								size={24}
								rounded={12}
								style={styles.thumb}
							/>
							<Text style={styles.chipText} numberOfLines={1} ellipsizeMode="tail">
								{exerciseDisplayName(item.id, locale)}
							</Text>
							{pickMode ? (
								<Plus color={colors.accentText} size={16} strokeWidth={2.25} />
							) : null}
						</Pressable>
					)}
				/>
				<LinearGradient
					colors={['transparent', colors.bg]}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 0 }}
					style={styles.mask}
					pointerEvents="none"
				/>
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		wrap: { marginTop: 24, marginHorizontal: -space.md },
		title: {
			marginLeft: space.lg,
			marginBottom: space.md,
			color: colors.text,
			fontSize: 14,
			lineHeight: 18,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		railWrap: { position: 'relative' },
		rail: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
		chip: {
			height: 40,
			maxWidth: 200,
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			paddingLeft: space.sm,
			paddingRight: space.md,
			borderRadius: radius.pill,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel
		},
		chipPressed: { backgroundColor: colors.accentDim, borderColor: colors.accent },
		thumb: { borderWidth: 0 },
		chipText: {
			flexShrink: 1,
			color: colors.text,
			fontSize: 13,
			lineHeight: 18,
			fontWeight: '500',
			fontFamily: fontFamily.medium
		},
		mask: {
			position: 'absolute',
			right: 0,
			top: 0,
			bottom: 0,
			width: 20
		}
	});
}
