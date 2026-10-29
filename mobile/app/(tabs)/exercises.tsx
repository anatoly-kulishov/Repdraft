import { useFocusEffect, useRouter } from 'expo-router';
import { BookOpen, Heart, List, SearchX, Trophy } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
	Alert,
	FlatList,
	Image,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { CUSTOM_EXERCISE_EQUIPMENT } from '@repdraft/domain/customExercises';
import {
	POPULAR_EXERCISE_IDS,
	frequentExercises,
	type FrequentExercise
} from '@repdraft/domain/exerciseFrequency';
import { labelBodyPart, labelEquipment } from '@repdraft/domain/labels.ru';
import { hasLiftData } from '@repdraft/domain/records';
import {
	filterExercises,
	loadExerciseIndex,
	refreshCustomsCache,
	uniqueBodyParts
} from '../../src/catalog/loadIndex';
import { catalogMediaUrl } from '../../src/catalog/mediaUrl';
import { zoneCoverMap } from '../../src/catalog/zoneCovers';
import { CatalogThumb } from '../../src/components/CatalogThumb';
import { Chip } from '../../src/components/Chip';
import { EmptyState } from '../../src/components/EmptyState';
import { ExerciseGridCard } from '../../src/components/ExerciseGridCard';
import { FrequentExercisesRail } from '../../src/components/FrequentExercisesRail';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useBottomChromePad, useTabScreenPad } from '../../src/layout/safe';
import { useLocale } from '../../src/state/locale';
import { bookmarksRepo } from '../../src/storage/bookmarksRepo';
import { customsRepo } from '../../src/storage/customsRepo';
import { recordsRepo } from '../../src/storage/recordsRepo';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../../src/theme';

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
	const [records, setRecords] = useState<number>(0);
	const [frequent, setFrequent] = useState<FrequentExercise[]>([]);
	const [tick, setTick] = useState(0);
	const [creating, setCreating] = useState(false);
	const [customName, setCustomName] = useState('');
	const [customPart, setCustomPart] = useState('upper arms');
	const [customEq, setCustomEq] = useState<string>(CUSTOM_EXERCISE_EQUIPMENT[0]);

	const reload = useCallback(() => {
		void (async () => {
			await refreshCustomsCache();
			setBookmarks(await bookmarksRepo.list());
			const recs = await recordsRepo.list();
			setRecords(recs.filter(hasLiftData).length);
			setFrequent(frequentExercises(await sessionsRepo.list()));
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
	const frequentItems = useMemo(() => {
		const byId = new Map(all.map((item) => [item.id, item] as const));
		const ids = frequent.length
			? frequent.map((row) => row.exerciseId)
			: [...POPULAR_EXERCISE_IDS];
		return ids
			.map((id) => byId.get(id))
			.filter((item): item is NonNullable<typeof item> => Boolean(item));
	}, [all, frequent]);
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
			<View style={styles.hubNavWrap}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={styles.hubNavScroll}
				contentContainerStyle={styles.hubNav}
			>
				<Pressable
					style={({ pressed }) => [styles.hubNavChip, pressed && styles.pressed]}
					onPress={() => {
						setSavedOnly(false);
						setBodyPart('all');
						setQuery('');
					}}
					accessibilityRole="button"
				>
					<List size={16} color={colors.text} strokeWidth={2} />
					<Text style={styles.hubNavText}>{tt('catalog.browseAll')}</Text>
				</Pressable>
				<Pressable
					style={({ pressed }) => [
						styles.hubNavChip,
						savedOnly && styles.hubNavChipActive,
						pressed && styles.pressed
					]}
					onPress={() => {
						setSavedOnly((v) => !v);
						setBodyPart('all');
						setQuery('');
					}}
					accessibilityRole="button"
				>
					<Heart size={16} color={savedOnly ? colors.accentText : colors.text} strokeWidth={2} />
					<Text style={[styles.hubNavText, savedOnly && styles.hubNavTextActive]}>
						{tt('bookmarks.title')}
					</Text>
				</Pressable>
				<Pressable
					style={({ pressed }) => [styles.hubNavChip, pressed && styles.pressed]}
					onPress={() => router.push('/records')}
					accessibilityRole="button"
				>
					<Trophy size={16} color={colors.text} strokeWidth={2} />
					<Text style={styles.hubNavText}>{tt('records.title')}</Text>
					{records > 0 ? (
						<View style={styles.countBadge}>
							<Text style={styles.countBadgeText}>{records}</Text>
						</View>
					) : null}
				</Pressable>
				<Pressable
					style={({ pressed }) => [styles.hubNavChip, pressed && styles.pressed]}
					onPress={() => router.push('/articles')}
					accessibilityRole="button"
				>
					<BookOpen size={16} color={colors.text} strokeWidth={2} />
					<Text style={styles.hubNavText}>{tt('articles.title')}</Text>
				</Pressable>
			</ScrollView>
			<LinearGradient
				colors={['transparent', colors.bg]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 0 }}
				style={styles.hubNavMask}
				pointerEvents="none"
			/>
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
				{filtered.length === 0 ? (
					<EmptyState
						title={
							savedOnly
								? tt('bookmarks.emptyTitle')
								: query.trim()
									? tt('catalog.emptyTitle')
									: tt('catalog.emptyTitle')
						}
						description={
							savedOnly
								? tt('bookmarks.emptyDesc')
								: query.trim()
									? tt('catalog.emptyDesc')
									: tt('catalog.emptyDesc')
						}
						icon={SearchX}
						onAction={() => {
							setSavedOnly(false);
							setQuery('');
							setBodyPart('all');
						}}
						actionLabel={savedOnly ? tt('bookmarks.browse') : tt('catalog.reset')}
					/>
				) : (
					<FlatList
						style={styles.flexList}
						data={filtered}
						keyExtractor={(item) => item.id}
						numColumns={2}
						columnWrapperStyle={styles.gridRow}
						initialNumToRender={12}
						windowSize={5}
						contentContainerStyle={[styles.grid, { paddingBottom: tabPad }]}
						renderItem={({ item }) => <ExerciseGridCard exercise={item} />}
					/>
				)}
			</>
		) : (
			<FlatList
				style={styles.flexList}
				data={parts}
				keyExtractor={(item) => item}
				numColumns={2}
				columnWrapperStyle={styles.hubRow}
					contentContainerStyle={[styles.grid, { paddingBottom: tabPad }]}
				ListHeaderComponent={
					<Text style={styles.hubLead}>{tt('exercises.hubLead')}</Text>
				}
				ListFooterComponent={
					<FrequentExercisesRail
						title={
							frequent.length > 0
								? tt('exercises.frequentTitle')
								: tt('exercises.popularTitle')
						}
						items={frequentItems}
						onPress={(item) => router.push(`/exercise/${item.id}`)}
					/>
				}
				renderItem={({ item }) => {
					const count = counts.get(item) ?? 0;
					const coverUri = catalogMediaUrl(covers[item]);
					const scrimId = `hubScrim-${item.replace(/\s+/g, '-')}`;
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
										<SvgLinearGradient id={scrimId} x1="0" y1="0" x2="0" y2="1">
											<Stop offset="0" stopColor={colors.panel} stopOpacity="0" />
											<Stop offset="0.42" stopColor={colors.panel} stopOpacity="0.72" />
											<Stop offset="1" stopColor={colors.panel} stopOpacity="0.96" />
										</SvgLinearGradient>
									</Defs>
									<Rect width="100%" height="100%" fill={`url(#${scrimId})`} />
								</Svg>
							</View>
							<View style={styles.hubCaption}>
								<Text style={styles.hubTitle} numberOfLines={2}>
									{labelBodyPart(item, locale)}
								</Text>
								<Text style={styles.hubMeta}>
									{count} {tt('common.exercises')}
								</Text>
							</View>
						</Pressable>
					);
				}}
			/>
		)}
			<Modal visible={creating} animationType="slide" transparent onRequestClose={() => setCreating(false)}>
				<KeyboardAvoidingView
					style={styles.sheetWrap}
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				>
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
			</KeyboardAvoidingView>
		</Modal>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
	root: { flex: 1, padding: space.md, gap: space.sm, backgroundColor: colors.bg },
	search: {
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
	hubNavWrap: { position: 'relative' },
	hubNavScroll: { flexGrow: 0, flexShrink: 0 },
	hubNavMask: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 20 },
	hubNav: { flexDirection: 'row', gap: space.sm, paddingRight: space.sm },
	hubNavChip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		minHeight: touchMin,
		paddingHorizontal: space.md,
		borderRadius: radius.pill,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel
	},
	hubNavChipActive: {
		borderColor: colors.accent,
		backgroundColor: colors.accentDim
	},
	hubNavText: {
		color: colors.text,
		fontSize: 14,
		fontWeight: '600',
		fontFamily: fontFamily.semibold
	},
	hubNavTextActive: {
		color: colors.accentText,
		fontWeight: '700',
		fontFamily: fontFamily.bold
	},
	countBadge: {
		backgroundColor: colors.accent,
		borderRadius: 999,
		minWidth: 18,
		height: 18,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 5
	},
	countBadgeText: {
		color: colors.accentInk,
		fontSize: 11,
		fontWeight: '800',
		fontFamily: fontFamily.extrabold
	},
	pressed: { opacity: 0.85 },
	flexList: { flex: 1 },
	chipStrip: { flexGrow: 0, flexShrink: 0, height: touchMin },
	chips: { gap: space.sm, alignItems: 'center', paddingVertical: 0 },
	grid: { gap: space.md },
	gridRow: { gap: space.md },
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
	sheetTitle: {
		color: colors.text,
		fontSize: 20,
		fontWeight: '800',
		fontFamily: fontFamily.extrabold
	},
	sheetLabel: {
		color: colors.muted,
		fontWeight: '600',
		fontSize: 13,
		fontFamily: fontFamily.semibold
	},
	hubLead: {
		color: colors.muted,
		marginBottom: space.sm,
		width: '100%',
		fontFamily: fontFamily.regular
	},
	hubRow: { gap: space.sm },
	hubCard: {
		flex: 1,
		aspectRatio: 0.75,
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
		backgroundColor: colors.panel
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
	hubTitle: {
		color: colors.text,
		fontWeight: '800',
		fontSize: 14,
		fontFamily: fontFamily.extrabold
	},
	hubMeta: {
		color: colors.muted,
		marginTop: 4,
		fontSize: 11,
		fontFamily: fontFamily.medium
	}
	});
}
