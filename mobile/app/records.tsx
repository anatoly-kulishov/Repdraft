import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
	Alert,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import {
	coerceReps,
	coerceWeightKg,
	filterRepsInput,
	filterWeightInput,
	LIVE_REPS,
	NOTE_MAX,
	sanitizeNote
} from '@repdraft/domain/inputLimits';
import { personalRecordChips } from '@repdraft/domain/records';
import { shouldShowCoachmark } from '@repdraft/domain/onboarding';
import type { PersonalRecord } from '@repdraft/domain/types';
import { exerciseDisplayName, getIndexItem, refreshCustomsCache } from '../src/catalog/loadIndex';
import { CatalogThumb } from '../src/components/CatalogThumb';
import { Coachmark } from '../src/components/Coachmark';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { useLocale } from '../src/state/locale';
import { dismissCoachmark, loadOnboarding } from '../src/state/onboarding';
import { recordsRepo } from '../src/storage/recordsRepo';
import { pushRecord, deleteRecordRemote } from '../src/sync/cloudSync';
import { useBottomChromePad } from '../src/layout/safe';
import { useAppColors } from '../src/state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../src/theme';

const CATALOG_PAGE_SIZE = 24;

export default function RecordsScreen() {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const listPad = useBottomChromePad(space.lg);
	const [records, setRecords] = useState<PersonalRecord[]>([]);
	const [query, setQuery] = useState('');
	const [editing, setEditing] = useState<PersonalRecord | null>(null);
	const [weightText, setWeightText] = useState('');
	const [repsText, setRepsText] = useState('');
	const [noteText, setNoteText] = useState('');
	const [visibleLimit, setVisibleLimit] = useState(CATALOG_PAGE_SIZE);
	const [showCoachmark, setShowCoachmark] = useState(false);

	const reload = useCallback(() => {
		void (async () => {
			await refreshCustomsCache();
			setRecords(await recordsRepo.list());
			const ob = await loadOnboarding();
			setShowCoachmark(records.length === 0 && shouldShowCoachmark(ob, 'records.empty'));
		})();
	}, []);

	useFocusEffect(
		useCallback(() => {
			reload();
		}, [reload])
	);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase().replace(/ё/g, 'е');
		if (!q) return records;
		return records.filter((r) => {
			const nameHit = exerciseDisplayName(r.exerciseId, locale).toLowerCase().replace(/ё/g, 'е').includes(q);
			const noteHit = (r.note ?? '').toLowerCase().replace(/ё/g, 'е').includes(q);
			return nameHit || noteHit;
		});
	}, [records, query, locale]);
	const visibleRecords = useMemo(
		() => filtered.slice(0, visibleLimit),
		[filtered, visibleLimit]
	);
	const hasMore = filtered.length > visibleLimit;

	function loadMore() {
		if (visibleLimit >= filtered.length) return;
		setVisibleLimit(Math.min(filtered.length, visibleLimit + CATALOG_PAGE_SIZE));
	}

	function openEdit(item: PersonalRecord) {
		setEditing(item);
		setWeightText(item.weightKg != null ? String(item.weightKg) : '');
		setRepsText(item.reps != null ? String(item.reps) : '');
		setNoteText(item.note ?? '');
	}

	async function saveEdit() {
		if (!editing) return;
		const weightKg = weightText.trim() ? coerceWeightKg(filterWeightInput(weightText)) : null;
		const reps = repsText.trim() ? coerceReps(filterRepsInput(repsText, LIVE_REPS), LIVE_REPS) : null;
		const note = sanitizeNote(noteText);
		if (weightKg == null && reps == null && note.length === 0) {
			Alert.alert(tt('common.error'), tt('live.invalidReps'));
			return;
		}
		const next: PersonalRecord = {
			...editing,
			weightKg,
			reps,
			note,
			updatedAt: new Date().toISOString()
		};
		await recordsRepo.save(next);
		try {
			await pushRecord(next);
		} catch {
			/* offline */
		}
		setEditing(null);
		reload();
	}

	function confirmDelete(item: PersonalRecord) {
		Alert.alert(tt('records.delete'), exerciseDisplayName(item.exerciseId, locale), [
			{ text: tt('common.cancel'), style: 'cancel' },
			{
				text: tt('records.delete'),
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await recordsRepo.remove(item.exerciseId);
						try {
							await deleteRecordRemote(item.exerciseId);
						} catch {
							/* offline */
						}
						reload();
					})();
				}
			}
		]);
	}

	return (
		<View style={styles.root}>
			<TextInput
				value={query}
				onChangeText={(v) => {
					setQuery(v);
					setVisibleLimit(CATALOG_PAGE_SIZE);
				}}
				placeholder={tt('catalog.search')}
				placeholderTextColor={colors.muted}
				style={styles.search}
			/>
			<Text style={styles.count}>
				{tt('catalog.countShown', { shown: String(visibleRecords.length), n: String(filtered.length) })}
			</Text>
			{editing ? (
				<View style={styles.editCard}>
					<Text style={styles.title}>{exerciseDisplayName(editing.exerciseId, locale)}</Text>
					<View style={styles.editRow}>
						<TextInput
							style={styles.input}
							value={weightText}
							onChangeText={(v) => setWeightText(filterWeightInput(v, weightText))}
							keyboardType="decimal-pad"
							placeholder={tt('common.kg')}
							placeholderTextColor={colors.muted}
						/>
						<TextInput
							style={styles.input}
							value={repsText}
							onChangeText={(v) => setRepsText(filterRepsInput(v, LIVE_REPS, repsText))}
							keyboardType="number-pad"
							placeholder={tt('common.reps')}
							placeholderTextColor={colors.muted}
						/>
					</View>
					<TextInput
						style={styles.noteInput}
						value={noteText}
						onChangeText={(v) => setNoteText(v.slice(0, NOTE_MAX))}
						placeholder={tt('pr.note')}
						placeholderTextColor={colors.muted}
						multiline
						maxLength={NOTE_MAX}
					/>
					<PrimaryButton label={tt('common.save')} onPress={() => void saveEdit()} />
					<PrimaryButton
						label={tt('common.cancel')}
						variant="ghost"
						onPress={() => setEditing(null)}
					/>
				</View>
			) : null}
			<FlatList
				style={{ flex: 1 }}
				data={visibleRecords}
				keyExtractor={(item) => item.exerciseId}
				ListEmptyComponent={
					<View style={styles.emptyWrap}>
						<Text style={styles.empty}>{tt('records.emptyTitle')}</Text>
						{showCoachmark ? (
							<Coachmark
								message={tt('onboarding.coachRecordsEmpty')}
								onDismiss={() => {
									setShowCoachmark(false);
									void dismissCoachmark('records.empty');
								}}
							/>
						) : null}
					</View>
				}
				contentContainerStyle={{ gap: space.sm, flexGrow: 1, paddingBottom: listPad }}
				onEndReached={loadMore}
				onEndReachedThreshold={0.5}
				ListFooterComponent={
					hasMore ? (
						<View style={styles.loadMore}>
							<View style={styles.loadMoreDot} />
						</View>
					) : undefined
				}
				renderItem={({ item }) => {
					const chips = personalRecordChips(item, locale);
					const liftChip = chips[0] ?? '';
					const noteChip = item.note?.trim();
					return (
						<Pressable
							style={styles.row}
							onPress={() => router.push(`/exercise/${item.exerciseId}`)}
							onLongPress={() => {
								Alert.alert(exerciseDisplayName(item.exerciseId, locale), undefined, [
									{ text: tt('common.cancel'), style: 'cancel' },
									{ text: tt('records.edit'), onPress: () => openEdit(item) },
									{
										text: tt('records.delete'),
										style: 'destructive',
										onPress: () => confirmDelete(item)
									}
								]);
							}}
						>
							<CatalogThumb imagePath={getIndexItem(item.exerciseId)?.image} size={48} />
							<View style={styles.rowBody}>
								<Text style={styles.title} numberOfLines={2}>
									{exerciseDisplayName(item.exerciseId, locale)}
								</Text>
								<View style={styles.metaRow}>
									{liftChip ? <Text style={styles.liftChip}>{liftChip}</Text> : null}
									{noteChip ? (
										<Text style={styles.noteChip} numberOfLines={1}>
											{noteChip}
										</Text>
									) : null}
								</View>
							</View>
							<ChevronRight color={colors.muted} size={16} strokeWidth={2.25} />
						</Pressable>
					);
				}}
			/>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
	root: { flex: 1, padding: 16, backgroundColor: colors.bg, gap: 10 },
	search: {
		minHeight: touchMin,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel,
		color: colors.text,
		paddingHorizontal: 14
	},
	count: { color: colors.muted, fontSize: 13, fontFamily: fontFamily.regular },
	editCard: {
		backgroundColor: colors.panel,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 14,
		gap: 10
	},
	editRow: { flexDirection: 'row', gap: 8 },
	input: {
		flex: 1,
		minHeight: touchMin,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.bg,
		color: colors.text,
		paddingHorizontal: 12,
		textAlign: 'center',
		fontWeight: '700',
		fontFamily: fontFamily.bold
	},
	noteInput: {
		minHeight: touchMin,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.bg,
		color: colors.text,
		padding: 12,
		fontSize: 15,
		textAlignVertical: 'top',
		fontFamily: fontFamily.regular
	},
	emptyWrap: { padding: space.md, gap: space.md },
	empty: { color: colors.muted, textAlign: 'center', marginTop: 48 },
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
	rowBody: { flex: 1 },
	title: { color: colors.text, fontWeight: '700', fontFamily: fontFamily.bold },
	metaRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.sm,
		marginTop: 4,
		flexWrap: 'wrap'
	},
	liftChip: { color: colors.accent, fontWeight: '700', fontVariant: ['tabular-nums'], fontFamily: fontFamily.bold },
	noteChip: {
		color: colors.muted,
		fontSize: 13,
		flex: 1,
		fontFamily: fontFamily.regular
	},
	loadMore: {
		minHeight: touchMin,
		alignItems: 'center',
		justifyContent: 'center'
	},
	loadMoreDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: colors.panel
	}
	});
}
