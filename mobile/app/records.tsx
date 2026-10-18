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
	LIVE_REPS
} from '@repdraft/domain/inputLimits';
import type { PersonalRecord } from '@repdraft/domain/types';
import { exerciseDisplayName, refreshCustomsCache } from '../src/catalog/loadIndex';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { useLocale } from '../src/state/locale';
import { recordsRepo } from '../src/storage/recordsRepo';
import { pushRecord, deleteRecordRemote } from '../src/sync/cloudSync';
import { useBottomChromePad } from '../src/layout/safe';
import { useAppColors } from '../src/state/theme';
import { space, touchMin, type ColorPalette } from '../src/theme';

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

	const reload = useCallback(() => {
		void (async () => {
			await refreshCustomsCache();
			setRecords(await recordsRepo.list());
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
		return records.filter((r) =>
			exerciseDisplayName(r.exerciseId, locale).toLowerCase().replace(/ё/g, 'е').includes(q)
		);
	}, [records, query, locale]);

	function openEdit(item: PersonalRecord) {
		setEditing(item);
		setWeightText(item.weightKg != null ? String(item.weightKg) : '');
		setRepsText(item.reps != null ? String(item.reps) : '');
	}

	async function saveEdit() {
		if (!editing) return;
		const weightKg = weightText.trim() ? coerceWeightKg(filterWeightInput(weightText)) : null;
		const reps = repsText.trim() ? coerceReps(filterRepsInput(repsText, LIVE_REPS), LIVE_REPS) : null;
		if (weightKg == null && reps == null) {
			Alert.alert(tt('common.error'), tt('live.invalidReps'));
			return;
		}
		const next: PersonalRecord = {
			...editing,
			weightKg,
			reps,
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
				onChangeText={setQuery}
				placeholder={tt('exercises.search')}
				placeholderTextColor={colors.muted}
				style={styles.search}
			/>
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
					<PrimaryButton label={tt('history.save')} onPress={() => void saveEdit()} />
					<PrimaryButton
						label={tt('common.cancel')}
						variant="ghost"
						onPress={() => setEditing(null)}
					/>
				</View>
			) : null}
			<FlatList
				style={{ flex: 1 }}
				data={filtered}
				keyExtractor={(item) => item.exerciseId}
				ListEmptyComponent={<Text style={styles.empty}>{tt('records.empty')}</Text>}
				contentContainerStyle={{ gap: space.sm, flexGrow: 1, paddingBottom: listPad }}
				renderItem={({ item }) => (
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
						<View style={styles.rowBody}>
							<Text style={styles.title} numberOfLines={2}>
								{exerciseDisplayName(item.exerciseId, locale)}
							</Text>
							<Text style={styles.meta} numberOfLines={1}>
								{item.weightKg != null ? `${item.weightKg} ${tt('common.kg')}` : '-'} ×{' '}
								{item.reps ?? '-'} {tt('common.reps')}
							</Text>
						</View>
						<ChevronRight color={colors.muted} size={16} strokeWidth={2.25} />
					</Pressable>
				)}
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
		fontWeight: '700'
	},
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
	title: { color: colors.text, fontWeight: '700' },
	meta: { color: colors.muted, marginTop: 4, fontVariant: ['tabular-nums'] }
	});
}
