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
import { completedSetCount, sessionDurationMs } from '@repdraft/domain/session';
import type { WorkoutSession } from '@repdraft/domain/types';
import { formatDurationMinutes, formatRelativeDay } from '@repdraft/i18n/format';
import { Chip } from '../../src/components/Chip';
import { useLocale } from '../../src/state/locale';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { deleteSessionRemote } from '../../src/sync/cloudSync';
import { useBottomChromePad } from '../../src/layout/safe';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../../src/theme';

type Preset = 'today' | 'all' | '7d' | '30d' | '90d';

function withinPreset(finishedAt: string, preset: Preset): boolean {
	const t = new Date(finishedAt).getTime();
	if (!Number.isFinite(t)) return false;
	if (preset === 'today') {
		const now = new Date();
		const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const end = start + 86400000;
		return t >= start && t < end;
	}
	if (preset === 'all') return true;
	const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
	return t >= Date.now() - days * 86400000;
}

export default function HistoryListScreen() {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const listPad = useBottomChromePad(space.lg);
	const [sessions, setSessions] = useState<WorkoutSession[]>([]);
	const [query, setQuery] = useState('');
	const [preset, setPreset] = useState<Preset>('all');

	const reload = useCallback(() => {
		void sessionsRepo.list().then(setSessions);
	}, []);

	useFocusEffect(
		useCallback(() => {
			reload();
		}, [reload])
	);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase().replace(/ё/g, 'е');
		return sessions
			.filter((s) => s.finishedAt)
			.filter((s) => withinPreset(s.finishedAt!, preset))
			.filter((s) => {
				if (!q) return true;
				return s.planName.toLowerCase().replace(/ё/g, 'е').includes(q);
			});
	}, [sessions, query, preset]);

	function confirmDelete(item: WorkoutSession) {
		Alert.alert(tt('history.delete'), item.planName, [
			{ text: tt('common.cancel'), style: 'cancel' },
			{
				text: tt('history.delete'),
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await sessionsRepo.remove(item.id);
						try {
							await deleteSessionRemote(item.id);
						} catch {
							/* offline */
						}
						reload();
					})();
				}
			}
		]);
	}

	const presets: { id: Preset; label: string }[] = [
		{ id: 'today', label: tt('history.filterToday') },
		{ id: 'all', label: tt('history.filterAll') },
		{ id: '7d', label: tt('history.filter7') },
		{ id: '30d', label: tt('history.filter30') },
		{ id: '90d', label: tt('history.filter90') }
	];

	return (
		<View style={styles.root}>
			<TextInput
				value={query}
				onChangeText={setQuery}
				placeholder={tt('workouts.historySearchPh')}
				placeholderTextColor={colors.muted}
				style={styles.search}
			/>
			<View style={styles.chips}>
				{presets.map((p) => (
					<Chip
						key={p.id}
						label={p.label}
						selected={preset === p.id}
						onPress={() => setPreset(p.id)}
					/>
				))}
			</View>
			<FlatList
				style={{ flex: 1 }}
				data={filtered}
				keyExtractor={(item) => item.id}
				ListEmptyComponent={<Text style={styles.empty}>{tt('history.empty')}</Text>}
				contentContainerStyle={{ gap: space.sm, flexGrow: 1, paddingBottom: listPad }}
				renderItem={({ item }) => (
					<Pressable
						style={styles.row}
						onPress={() => router.push(`/history/${item.id}`)}
						onLongPress={() => confirmDelete(item)}
					>
						<Text style={styles.title} numberOfLines={2}>
							{item.planName}
						</Text>
						<Text style={styles.meta} numberOfLines={1}>
							{formatRelativeDay(item.finishedAt ?? item.startedAt, locale)} ·{' '}
							{formatDurationMinutes(sessionDurationMs(item)) ?? '-'} {tt('summary.min')} ·{' '}
							{completedSetCount(item)} {tt('history.setsCount')}
						</Text>
					</Pressable>
				)}
			/>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
	root: { flex: 1, padding: space.lg, backgroundColor: colors.bg, gap: space.sm },
	search: {
		minHeight: touchMin,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel,
		color: colors.text,
		paddingHorizontal: 14
	},
	chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	empty: { color: colors.muted, textAlign: 'center', marginTop: 48 },
	row: {
		minHeight: touchMin,
		backgroundColor: colors.panel,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 14
	},
	title: { color: colors.text, fontWeight: '700', fontSize: 16, fontFamily: fontFamily.bold },
	meta: { color: colors.muted, marginTop: 4, fontFamily: fontFamily.regular }
	});
}
