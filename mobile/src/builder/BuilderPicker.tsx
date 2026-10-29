import { useMemo } from 'react';
import {
	FlatList,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import { labelBodyPart } from '@repdraft/domain/labels.ru';
import type { ExerciseIndexItem } from '@repdraft/domain/types';
import type { FrequentExercise } from '@repdraft/domain/exerciseFrequency';
import { CatalogThumb } from '../components/CatalogThumb';
import { FrequentExercisesRail } from '../components/FrequentExercisesRail';
import { PrimaryButton } from '../components/PrimaryButton';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	query: string;
	onQueryChange: (value: string) => void;
	bodyPart: string | 'all';
	onBodyPartChange: (value: string | 'all') => void;
	parts: string[];
	pickList: ExerciseIndexItem[];
	frequentItems: ExerciseIndexItem[];
	frequentCount: number;
	inPlanIds: Set<string>;
	flashId: string | null;
	railNote: string | null;
	planExerciseCount: number;
	headerOffset: number;
	bottomPad: number;
	onAdd: (item: ExerciseIndexItem) => void;
	onDone: () => void;
};

/** Builder "add exercise" mode: search, chips, frequent rail and pick list. */
export function BuilderPicker({
	query,
	onQueryChange,
	bodyPart,
	onBodyPartChange,
	parts,
	pickList,
	frequentItems,
	frequentCount,
	inPlanIds,
	flashId,
	railNote,
	planExerciseCount,
	headerOffset,
	bottomPad,
	onAdd,
	onDone
}: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<KeyboardAvoidingView
			style={styles.root}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			keyboardVerticalOffset={Platform.OS === 'ios' ? headerOffset : 0}
		>
			<TextInput
				style={styles.input}
				value={query}
				onChangeText={onQueryChange}
				placeholder={tt('exercises.search')}
				placeholderTextColor={colors.muted}
				autoFocus
			/>
			<Text style={styles.pickHint}>{tt('builder.pickHint')}</Text>
			<FlatList
				horizontal
				style={styles.chipStrip}
				data={['all', ...parts] as const}
				keyExtractor={(part) => part}
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.chips}
				renderItem={({ item: part }) => {
					const on = bodyPart === part;
					const label = part === 'all' ? tt('exercises.all') : labelBodyPart(part, locale);
					return (
						<Pressable style={[styles.chip, on && styles.chipOn]} onPress={() => onBodyPartChange(part)}>
							<Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
								{label}
							</Text>
						</Pressable>
					);
				}}
			/>
			<FrequentExercisesRail
				title={
					frequentCount > 0
						? tt('exercises.frequentTitle')
						: tt('exercises.popularTitle')
				}
				items={frequentItems}
				pickMode
				onPress={onAdd}
			/>
			{railNote ? <Text style={styles.railNote}>{railNote}</Text> : null}
			<FlatList
				style={styles.flex}
				data={pickList}
				keyExtractor={(item) => item.id}
				keyboardShouldPersistTaps="handled"
				initialNumToRender={24}
				windowSize={8}
				contentContainerStyle={styles.list}
				ListEmptyComponent={<Text style={styles.emptyPick}>{tt('builder.noMatches')}</Text>}
				renderItem={({ item }) => {
					const inPlan = inPlanIds.has(item.id);
					const flashed = flashId === item.id;
					return (
						<Pressable
							style={[styles.pickRow, inPlan && styles.pickRowIn, flashed && styles.pickRowFlash]}
							onPress={() => onAdd(item)}
						>
							<CatalogThumb imagePath={item.image} size={48} />
							<View style={styles.flex}>
								<Text style={styles.rowTitle} numberOfLines={2}>
									{item.name_ru?.trim() || item.name}
								</Text>
								<Text style={styles.meta} numberOfLines={1}>
									{item.body_part}
									{item.equipment ? ` · ${item.equipment}` : ''}
								</Text>
							</View>
							<Text style={[styles.pickMark, inPlan && styles.pickMarkOn]}>
								{inPlan ? '✓' : '+'}
							</Text>
						</Pressable>
					);
				}}
			/>
			<View style={[styles.sticky, { paddingBottom: bottomPad }]}>
				<PrimaryButton label={`${tt('builder.done')} (${planExerciseCount})`} onPress={onDone} />
			</View>
		</KeyboardAvoidingView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: { flex: 1, padding: space.lg, gap: space.sm, backgroundColor: colors.bg },
		flex: { flex: 1 },
		input: {
			minHeight: touchMin,
			borderRadius: radius.sm,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel,
			color: colors.text,
			paddingHorizontal: space.md,
			fontSize: 16,
			fontFamily: fontFamily.regular
		},
		pickHint: { color: colors.muted, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
		railNote: {
			color: colors.success,
			fontSize: 13,
			fontWeight: '600',
			fontFamily: fontFamily.semibold,
			marginTop: space.sm
		},
		chipStrip: { flexGrow: 0, flexShrink: 0, height: touchMin },
		chips: { gap: space.sm, alignItems: 'center', paddingVertical: 0 },
		chip: {
			justifyContent: 'center',
			minHeight: touchMin,
			paddingHorizontal: space.md,
			borderRadius: radius.pill,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel
		},
		chipOn: { borderColor: colors.accent, backgroundColor: colors.accentDim },
		chipText: {
			color: colors.text,
			fontSize: 14,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		chipTextOn: { color: colors.accentText, fontWeight: '700', fontFamily: fontFamily.bold },
		list: { paddingBottom: space.lg, gap: space.sm },
		emptyPick: { color: colors.muted, textAlign: 'center', marginTop: 24 },
		pickRow: {
			minHeight: touchMin,
			paddingHorizontal: space.sm,
			paddingVertical: space.sm,
			borderRadius: radius.sm,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel,
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm
		},
		pickRowIn: { opacity: 0.55 },
		pickRowFlash: { borderColor: colors.accent, backgroundColor: colors.accentDim },
		rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600', fontFamily: fontFamily.semibold },
		meta: { color: colors.muted, fontSize: 12, fontFamily: fontFamily.regular, marginTop: 2 },
		pickMark: { color: colors.accent, fontSize: 18, fontWeight: '700', fontFamily: fontFamily.bold },
		pickMarkOn: { color: colors.muted },
		sticky: {
			paddingTop: space.sm,
			backgroundColor: colors.bg,
			gap: space.sm
		}
	});
}
