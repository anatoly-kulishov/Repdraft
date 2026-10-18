import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
	Alert,
	FlatList,
	Image,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { CUSTOM_EXERCISE_EQUIPMENT } from '@repdraft/domain/customExercises';
import { labelBodyPart, labelEquipment } from '@repdraft/domain/labels.ru';
import {
	exerciseDisplayName,
	filterExercises,
	loadExerciseIndex,
	refreshCustomsCache,
	uniqueBodyParts
} from '../../src/catalog/loadIndex';
import { catalogMediaUrl } from '../../src/catalog/mediaUrl';
import { zoneCoverMap } from '../../src/catalog/zoneCovers';
import { CatalogThumb } from '../../src/components/CatalogThumb';
import { Chip } from '../../src/components/Chip';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useBottomChromePad, useTabScreenPad } from '../../src/layout/safe';
import { useLocale } from '../../src/state/locale';
import { bookmarksRepo } from '../../src/storage/bookmarksRepo';
import { customsRepo } from '../../src/storage/customsRepo';
import { useAppColors } from '../../src/state/theme';
import { radius, space, touchMin, type ColorPalette } from '../../src/theme';

export default function ExercisesScreen() {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const router = useRouter();
	const bottomPad = useBottomChromePad(space.md);
	const tabPad = useTabScreenPad(space.lg);
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
	const covers = useMemo(() => zoneCoverMap(all), [all]);
	const counts = useMemo(() => {
		const map = new Map<string, number>();
		for (const ex of all) {
			map.set(ex.body_part, (map.get(ex.body_part) ?? 0) + 1);
		}
		return map;
	}, [all]);

	const filtered = useMemo(() => {
		let list = filterExercises(all, { query, bodyPart, locale });
		if (savedOnly) {
			const set = new Set(bookmarks);
			list = list.filter((ex) => set.has(ex.id));
		}
		return list;
	}, [all, query, bodyPart, locale, savedOnly, bookmarks]);

	const bookmarkSet = useMemo(() => new Set(bookmarks), [bookmarks]);

	function zoneLabel(part: string): string {
		return part === 'all' ? tt('exercises.all') : labelBodyPart(part, locale);
	}

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
			{query.trim() || savedOnly || bodyPart !== 'all' ? (
				<>
					<FlatList
						horizontal
						style={styles.chipStrip}
						data={['all', ...parts]}
						keyExtractor={(item) => item}
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.chips}
					renderItem={({ item }) => (
						<Chip
							label={zoneLabel(item)}
							selected={bodyPart === item}
							onPress={() => setBodyPart(item)}
						/>
					)}
				/>
				<FlatList
					style={styles.flexList}
					data={filtered}
					keyExtractor={(item) => item.id}
					initialNumToRender={20}
					windowSize={7}
					contentContainerStyle={[styles.list, { paddingBottom: tabPad }]}
					renderItem={({ item }) => {
						const bookmarked = bookmarkSet.has(item.id);
						return (
							<Pressable style={styles.row} onPress={() => router.push(`/exercise/${item.id}`)}>
								<CatalogThumb imagePath={item.image} size={56} />
								<View style={styles.rowCopy}>
									<Text style={styles.rowTitle} numberOfLines={2}>
										{exerciseDisplayName(item.id, locale)}
									</Text>
									<Text style={styles.rowMeta} numberOfLines={1}>
										{labelBodyPart(item.body_part, locale)} · {item.equipment}
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
			</>
		) : (
			<FlatList
				style={styles.flexList}
				data={parts}
				keyExtractor={(item) => item}
				numColumns={2}
				columnWrapperStyle={styles.hubRow}
				contentContainerStyle={[styles.list, { paddingBottom: tabPad }]}
				ListHeaderComponent={
					<Text style={styles.hubLead}>{tt('exercises.hubLead')}</Text>
				}
				renderItem={({ item }) => {
					const count = counts.get(item) ?? 0;
					const coverUri = catalogMediaUrl(covers[item]);
					return (
						<Pressable style={styles.hubCard} onPress={() => setBodyPart(item)}>
							{coverUri ? (
								<Image source={{ uri: coverUri }} style={styles.hubImage} resizeMode="cover" />
							) : (
								<View style={[styles.hubImage, styles.hubFallback]}>
									<CatalogThumb imagePath={null} size={40} style={styles.hubFallbackThumb} />
								</View>
							)}
							<View style={styles.hubScrim}>
								<Svg height="100%" width="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none">
									<Defs>
										<SvgLinearGradient id="hubScrim" x1="0" y1="0" x2="0" y2="1">
											<Stop offset="0" stopColor="white" stopOpacity="0" />
											<Stop offset="0.42" stopColor="white" stopOpacity="0.72" />
											<Stop offset="1" stopColor="white" stopOpacity="0.96" />
										</SvgLinearGradient>
									</Defs>
									<Rect width="100%" height="100%" fill="url(#hubScrim)" />
								</Svg>
							</View>
							<View style={styles.hubCaption}>
								<Text style={[styles.hubTitle, styles.hubTitleLight]} numberOfLines={2}>
									{labelBodyPart(item, locale)}
								</Text>
								<Text style={[styles.hubMeta, styles.hubMetaLight]}>
									{count} {tt('common.exercises')}
								</Text>
							</View>
						</Pressable>
					);
				}}
			/>
		)}
			<Modal visible={creating} animationType="slide" transparent onRequestClose={() => setCreating(false)}>
				<View style={styles.sheetWrap}>
					<View style={[styles.sheet, { paddingBottom: bottomPad }]}>
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
							style={styles.chipStrip}
							data={parts.length ? parts : ['upper arms', 'chest', 'back', 'shoulders']}
							keyExtractor={(item) => item}
							contentContainerStyle={styles.chips}
							renderItem={({ item }) => (
								<Chip
									label={labelBodyPart(item, locale)}
									selected={customPart === item}
									onPress={() => setCustomPart(item)}
								/>
							)}
						/>
						<Text style={styles.sheetLabel}>{tt('exercises.equipment')}</Text>
						<FlatList
							horizontal
							style={styles.chipStrip}
							data={[...CUSTOM_EXERCISE_EQUIPMENT]}
							keyExtractor={(item) => item}
							contentContainerStyle={styles.chips}
							renderItem={({ item }) => (
						<Chip
								label={labelEquipment(item, locale)}
								selected={customEq === item}
								onPress={() => setCustomEq(item)}
							/>
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

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
	root: { flex: 1, padding: space.lg, gap: space.sm, backgroundColor: colors.bg },
	search: {
		minHeight: touchMin,
		borderRadius: radius.sm,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel,
		color: colors.text,
		paddingHorizontal: space.md,
		fontSize: 16
	},
	topActions: { flexDirection: 'row', gap: space.sm },
	flexList: { flex: 1 },
	chipStrip: { flexGrow: 0, flexShrink: 0, height: touchMin },
	chips: { gap: space.sm, alignItems: 'center', paddingVertical: 0 },
	list: { gap: space.sm },
	row: {
		minHeight: touchMin,
		backgroundColor: colors.panel,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		padding: space.md,
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm
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
		backgroundColor: colors.overlayScrim
	},
	sheet: {
		backgroundColor: colors.bg,
		borderTopLeftRadius: radius.xl,
		borderTopRightRadius: radius.xl,
		padding: space.lg,
		gap: space.sm,
		maxHeight: '85%'
	},
	sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
	sheetLabel: { color: colors.muted, fontWeight: '600', fontSize: 13 },
	hubLead: { color: colors.muted, marginBottom: space.sm, width: '100%' },
	hubRow: { gap: space.sm },
	hubCard: {
		flex: 1,
		minHeight: 128,
		aspectRatio: 1.05,
		backgroundColor: colors.panel,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		marginBottom: space.sm,
		overflow: 'hidden',
		justifyContent: 'flex-end'
	},
	hubImage: {
		...StyleSheet.absoluteFill,
		backgroundColor: colors.panelRaised
	},
	hubFallback: { alignItems: 'center', justifyContent: 'center' },
	hubFallbackThumb: { borderWidth: 0, backgroundColor: 'transparent' },
	hubScrim: {
		...StyleSheet.absoluteFill,
		backgroundColor: 'transparent'
	},
	hubCaption: {
		padding: space.md,
		zIndex: 1
	},
	hubTitle: { color: '#f5f5f7', fontWeight: '800', fontSize: 16 },
	hubTitleLight: { color: '#0f1012' },
	hubMeta: { color: 'rgba(245,245,247,0.82)', marginTop: 4, fontSize: 13 },
	hubMetaLight: { color: '#636366' }
	});
}
