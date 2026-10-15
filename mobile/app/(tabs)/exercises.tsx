import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
	Alert,
	FlatList,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import { CUSTOM_EXERCISE_EQUIPMENT } from '@repdraft/domain/customExercises';
import {
	exerciseDisplayName,
	filterExercises,
	loadExerciseIndex,
	refreshCustomsCache,
	uniqueBodyParts
} from '../../src/catalog/loadIndex';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useLocale } from '../../src/state/locale';
import { bookmarksRepo } from '../../src/storage/bookmarksRepo';
import { customsRepo } from '../../src/storage/customsRepo';
import { colors, touchMin } from '../../src/theme';

export default function ExercisesScreen() {
	const { locale, tt } = useLocale();
	const router = useRouter();
	const [query, setQuery] = useState('');
	const [bodyPart, setBodyPart] = useState<string | 'all'>('all');
	const [savedOnly, setSavedOnly] = useState(false);
	const [bookmarks, setBookmarks] = useState<string[]>([]);
	const [tick, setTick] = useState(0);
	const [creating, setCreating] = useState(false);
	const [customName, setCustomName] = useState('');
	const [customPart, setCustomPart] = useState('upper arms');
	const [customEq, setCustomEq] = useState<string>(CUSTOM_EXERCISE_EQUIPMENT[0]);

	const reload = useCallback(() => {
		void (async () => {
			await refreshCustomsCache();
			setBookmarks(await bookmarksRepo.list());
			setTick((n) => n + 1);
		})();
	}, []);

	useFocusEffect(
		useCallback(() => {
			reload();
		}, [reload])
	);

	const all = useMemo(() => {
		void tick;
		return loadExerciseIndex();
	}, [tick]);
	const parts = useMemo(() => uniqueBodyParts(all), [all]);

	const filtered = useMemo(() => {
		let list = filterExercises(all, { query, bodyPart, locale });
		if (savedOnly) {
			const set = new Set(bookmarks);
			list = list.filter((ex) => set.has(ex.id));
		}
		return list;
	}, [all, query, bodyPart, locale, savedOnly, bookmarks]);

	const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);

	async function createCustom() {
		const result = await customsRepo.create({
			name: customName,
			bodyPart: customPart,
			equipment: customEq
		});
		if (!result.ok) {
			Alert.alert(tt('common.error'), tt('exercises.customFail'));
			return;
		}
		setCreating(false);
		setCustomName('');
		Alert.alert(tt('common.ok'), tt('exercises.customOk'));
		reload();
	}

	return (
		<View style={styles.root}>
			<TextInput
				value={query}
				onChangeText={setQuery}
				placeholder={tt('exercises.search')}
				placeholderTextColor={colors.muted}
				style={styles.search}
			/>
			<View style={styles.topActions}>
				<View style={{ flex: 1 }}>
					<PrimaryButton
						label={tt('exercises.records')}
						variant="ghost"
						onPress={() => router.push('/records')}
					/>
				</View>
				<View style={{ flex: 1 }}>
					<PrimaryButton
						label={tt('exercises.saved')}
						variant={savedOnly ? 'primary' : 'ghost'}
						onPress={() => setSavedOnly((v) => !v)}
					/>
				</View>
			</View>
			<PrimaryButton
				label={tt('exercises.custom')}
				variant="ghost"
				onPress={() => setCreating(true)}
			/>
			<FlatList
				horizontal
				data={['all', ...parts]}
				keyExtractor={(item) => item}
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.chips}
				renderItem={({ item }) => {
					const active = bodyPart === item;
					const label = item === 'all' ? tt('exercises.all') : item;
					return (
						<Pressable
							onPress={() => setBodyPart(item)}
							style={[styles.chip, active && styles.chipOn]}
						>
							<Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
						</Pressable>
					);
				}}
			/>
			<FlatList
				data={filtered}
				keyExtractor={(item) => item.id}
				initialNumToRender={24}
				windowSize={8}
				contentContainerStyle={styles.list}
				renderItem={({ item }) => {
					const bookmarked = bookmarkSet.has(item.id);
					return (
						<Pressable style={styles.row} onPress={() => router.push(`/exercise/${item.id}`)}>
							<View style={styles.rowCopy}>
								<Text style={styles.rowTitle} numberOfLines={2}>
									{exerciseDisplayName(item.id, locale)}
								</Text>
								<Text style={styles.rowMeta} numberOfLines={1}>
									{item.body_part} · {item.equipment}
								</Text>
							</View>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={tt('exercises.bookmark')}
								style={styles.star}
								onPress={() => {
									void bookmarksRepo.toggle(item.id).then(reload);
								}}
							>
								<Text style={[styles.starText, bookmarked && styles.starOn]}>
									{bookmarked ? '★' : '☆'}
								</Text>
							</Pressable>
						</Pressable>
					);
				}}
			/>

			<Modal visible={creating} animationType="slide" transparent onRequestClose={() => setCreating(false)}>
				<View style={styles.sheetWrap}>
					<View style={styles.sheet}>
						<Text style={styles.sheetTitle}>{tt('exercises.custom')}</Text>
						<TextInput
							style={styles.search}
							value={customName}
							onChangeText={setCustomName}
							placeholder={tt('exercises.customName')}
							placeholderTextColor={colors.muted}
						/>
						<Text style={styles.sheetLabel}>{tt('exercises.all')}</Text>
						<FlatList
							horizontal
							data={parts.length ? parts : ['upper arms', 'chest', 'back', 'shoulders']}
							keyExtractor={(item) => item}
							contentContainerStyle={styles.chips}
							renderItem={({ item }) => (
								<Pressable
									onPress={() => setCustomPart(item)}
									style={[styles.chip, customPart === item && styles.chipOn]}
								>
									<Text style={[styles.chipText, customPart === item && styles.chipTextOn]}>
										{item}
									</Text>
								</Pressable>
							)}
						/>
						<Text style={styles.sheetLabel}>{tt('exercises.equipment')}</Text>
						<FlatList
							horizontal
							data={[...CUSTOM_EXERCISE_EQUIPMENT]}
							keyExtractor={(item) => item}
							contentContainerStyle={styles.chips}
							renderItem={({ item }) => (
								<Pressable
									onPress={() => setCustomEq(item)}
									style={[styles.chip, customEq === item && styles.chipOn]}
								>
									<Text style={[styles.chipText, customEq === item && styles.chipTextOn]}>
										{item}
									</Text>
								</Pressable>
							)}
						/>
						<PrimaryButton label={tt('exercises.customCreate')} onPress={() => void createCustom()} />
						<PrimaryButton
							label={tt('common.cancel')}
							variant="ghost"
							onPress={() => setCreating(false)}
						/>
					</View>
				</View>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 16, gap: 10, backgroundColor: colors.bg },
	search: {
		minHeight: touchMin,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel,
		color: colors.text,
		paddingHorizontal: 14,
		fontSize: 16
	},
	topActions: { flexDirection: 'row', gap: 8 },
	chips: { gap: 8, paddingVertical: 4 },
	chip: {
		minHeight: touchMin,
		paddingHorizontal: 12,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel,
		alignItems: 'center',
		justifyContent: 'center'
	},
	chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
	chipText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
	chipTextOn: { color: colors.accentText },
	list: { gap: 8, paddingBottom: 24 },
	row: {
		minHeight: touchMin,
		backgroundColor: colors.panel,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 14,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8
	},
	rowCopy: { flex: 1, gap: 4 },
	rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
	rowMeta: { color: colors.muted, fontSize: 13 },
	star: { minWidth: touchMin, minHeight: touchMin, alignItems: 'center', justifyContent: 'center' },
	starText: { color: colors.muted, fontSize: 22 },
	starOn: { color: colors.accent },
	sheetWrap: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0,0,0,0.55)'
	},
	sheet: {
		backgroundColor: colors.bg,
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		padding: 16,
		gap: 10,
		maxHeight: '85%'
	},
	sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
	sheetLabel: { color: colors.muted, fontWeight: '600', fontSize: 13 }
});
