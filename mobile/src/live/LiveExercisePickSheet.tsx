import { useEffect, useMemo, useState } from 'react';
import {
	FlatList,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import {
	POPULAR_EXERCISE_IDS,
	frequentExercises
} from '@repdraft/domain/exerciseFrequency';
import { HOME_EQUIPMENT_FILTER, type HomeKitOptionalId } from '@repdraft/domain/homeKit';
import { exerciseMetaHint, labelBodyPart } from '@repdraft/domain/labels.ru';
import type { ExerciseIndexItem, WorkoutSession } from '@repdraft/domain/types';
import { BottomSheet } from '../components/BottomSheet';
import { CatalogThumb } from '../components/CatalogThumb';
import { exerciseDisplayName, filterExercises, uniqueBodyParts } from '../catalog/loadIndex';
import { useLocale } from '../state/locale';
import { getHomeKitSelection } from '../state/prefs';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

const SEARCH_CAP = 40;
const SUGGEST_CAP = 12;

type Mode = 'replace' | 'add';

type Props = {
	open: boolean;
	mode: Mode;
	catalog: ExerciseIndexItem[];
	history?: WorkoutSession[];
	/** Replace: open on this zone (current exercise body_part). */
	seedBodyPart?: string | null;
	busy?: boolean;
	onPick: (exerciseId: string) => void;
	onDismiss: () => void;
};

/** Short catalog pick for live replace/add - zone chips + thumb rows. */
export function LiveExercisePickSheet({
	open,
	mode,
	catalog,
	history = [],
	seedBodyPart = null,
	busy = false,
	onPick,
	onDismiss
}: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const [query, setQuery] = useState('');
	const [bodyPart, setBodyPart] = useState<string | 'all'>('all');
	const [equipment, setEquipment] = useState<'all' | typeof HOME_EQUIPMENT_FILTER>('all');
	const [homeKit, setHomeKit] = useState<HomeKitOptionalId[]>([]);

	useEffect(() => {
		if (!open) {
			setQuery('');
			setBodyPart('all');
			setEquipment('all');
			return;
		}
		setQuery('');
		setEquipment('all');
		setBodyPart(mode === 'replace' && seedBodyPart ? seedBodyPart : 'all');
		void getHomeKitSelection().then(setHomeKit);
	}, [mode, open, seedBodyPart]);

	const byId = useMemo(() => {
		const map = new Map<string, ExerciseIndexItem>();
		for (const item of catalog) map.set(item.id, item);
		return map;
	}, [catalog]);

	const zoneParts = useMemo(() => uniqueBodyParts(catalog), [catalog]);

	const suggestItems = useMemo(() => {
		const freq = frequentExercises(history, { limit: SUGGEST_CAP });
		const ids =
			freq.length > 0 ? freq.map((f) => f.exerciseId) : [...POPULAR_EXERCISE_IDS];
		const out: ExerciseIndexItem[] = [];
		const seen = new Set<string>();
		for (const id of ids) {
			if (seen.has(id)) continue;
			const item = byId.get(id);
			if (!item) continue;
			seen.add(id);
			out.push(item);
			if (out.length >= SUGGEST_CAP) break;
		}
		return out;
	}, [byId, history]);

	const results = useMemo(() => {
		if (!open) return [] as ExerciseIndexItem[];
		const q = query.trim();
		if (!q && bodyPart === 'all' && equipment === 'all') return suggestItems;
		return filterExercises(catalog, {
			query: q,
			bodyPart,
			locale,
			equipment,
			homeKit
		}).slice(0, SEARCH_CAP);
	}, [bodyPart, catalog, equipment, homeKit, locale, open, query, suggestItems]);

	const title =
		mode === 'replace' ? tt('live.replaceExerciseTitle') : tt('live.addExerciseTitle');
	const emptyLabel =
		query.trim() || bodyPart !== 'all' || equipment !== 'all'
			? tt('live.pickExerciseEmpty')
			: tt('live.pickExerciseSuggest');

	return (
		<BottomSheet
			open={open}
			onDismiss={() => {
				setQuery('');
				onDismiss();
			}}
			dismissible={!busy}
			label={title}
			maxHeight="82%"
		>
			<Text style={styles.title}>{title}</Text>
			{mode === 'replace' ? (
				<Text style={styles.hint}>{tt('live.replaceExerciseHint')}</Text>
			) : null}
			<TextInput
				style={styles.input}
				value={query}
				onChangeText={setQuery}
				placeholder={tt('live.pickExerciseSearch')}
				placeholderTextColor={colors.muted}
				autoFocus={open}
				editable={!busy}
				returnKeyType="search"
			/>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={styles.chipStrip}
				contentContainerStyle={styles.chips}
				keyboardShouldPersistTaps="handled"
			>
				<Pressable
					style={[styles.chip, bodyPart === 'all' && equipment === 'all' && styles.chipOn]}
					disabled={busy}
					onPress={() => {
						setBodyPart('all');
						setEquipment('all');
					}}
				>
					<Text
						style={[
							styles.chipText,
							bodyPart === 'all' && equipment === 'all' && styles.chipTextOn
						]}
					>
						{tt('exercises.all')}
					</Text>
				</Pressable>
				<Pressable
					style={[styles.chip, equipment === HOME_EQUIPMENT_FILTER && styles.chipOn]}
					disabled={busy}
					onPress={() => {
						setEquipment(HOME_EQUIPMENT_FILTER);
						setBodyPart('all');
					}}
				>
					<Text
						style={[
							styles.chipText,
							equipment === HOME_EQUIPMENT_FILTER && styles.chipTextOn
						]}
					>
						{tt('place.home')}
					</Text>
				</Pressable>
				{zoneParts.map((part) => {
					const on = bodyPart === part && equipment === 'all';
					return (
						<Pressable
							key={part}
							style={[styles.chip, on && styles.chipOn]}
							disabled={busy}
							onPress={() => {
								setBodyPart(part);
								setEquipment('all');
							}}
						>
							<Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
								{labelBodyPart(part, locale)}
							</Text>
						</Pressable>
					);
				})}
			</ScrollView>
			{results.length === 0 ? (
				<Text style={styles.muted}>{emptyLabel}</Text>
			) : (
				<FlatList
					style={styles.list}
					data={results}
					keyExtractor={(item) => item.id}
					keyboardShouldPersistTaps="handled"
					initialNumToRender={12}
					windowSize={6}
					renderItem={({ item }) => (
						<Pressable
							accessibilityRole="button"
							disabled={busy}
							style={({ pressed }) => [styles.row, pressed && styles.pressed]}
							onPress={() => {
								setQuery('');
								onPick(item.id);
							}}
						>
							<CatalogThumb imagePath={item.image} size={48} />
							<View style={styles.rowText}>
								<Text style={styles.rowName} numberOfLines={2}>
									{exerciseDisplayName(item.id, locale)}
								</Text>
								<Text style={styles.rowMeta} numberOfLines={1}>
									{exerciseMetaHint(item, locale)}
								</Text>
							</View>
						</Pressable>
					)}
				/>
			)}
		</BottomSheet>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		title: {
			fontSize: 17,
			fontWeight: '700',
			fontFamily: fontFamily.bold,
			color: colors.text,
			textAlign: 'left'
		},
		hint: {
			marginTop: space.xs,
			fontSize: 13,
			lineHeight: 18,
			color: colors.muted,
			textAlign: 'left'
		},
		muted: {
			marginTop: space.md,
			fontSize: 13,
			lineHeight: 19,
			color: colors.muted,
			textAlign: 'left'
		},
		input: {
			marginTop: space.md,
			minHeight: touchMin,
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: radius.md,
			paddingHorizontal: space.md,
			color: colors.text,
			fontSize: 16,
			fontFamily: fontFamily.regular,
			backgroundColor: colors.panel,
			textAlign: 'left'
		},
		chipStrip: { marginTop: space.sm, flexGrow: 0, flexShrink: 0 },
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
			fontSize: 13,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		chipTextOn: { color: colors.accentText, fontWeight: '700', fontFamily: fontFamily.bold },
		list: { marginTop: space.sm, flexGrow: 0 },
		row: {
			minHeight: touchMin,
			paddingVertical: space.sm,
			paddingHorizontal: space.xs,
			borderRadius: radius.sm,
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm
		},
		rowText: { flex: 1, minWidth: 0, gap: 2 },
		rowName: {
			fontSize: 15,
			fontWeight: '600',
			fontFamily: fontFamily.semibold,
			color: colors.text,
			textAlign: 'left'
		},
		rowMeta: {
			fontSize: 12,
			fontFamily: fontFamily.regular,
			color: colors.muted,
			textAlign: 'left'
		},
		pressed: { backgroundColor: colors.panel }
	});
}
