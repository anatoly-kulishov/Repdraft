import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { PersonalRecord } from '@repdraft/domain/types';
import { exerciseDisplayName, refreshCustomsCache } from '../src/catalog/loadIndex';
import { useLocale } from '../src/state/locale';
import { recordsRepo } from '../src/storage/recordsRepo';
import { colors, touchMin } from '../src/theme';

export default function RecordsScreen() {
	const { locale, tt } = useLocale();
	const [records, setRecords] = useState<PersonalRecord[]>([]);

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				await refreshCustomsCache();
				setRecords(await recordsRepo.list());
			})();
		}, [])
	);

	return (
		<View style={styles.root}>
			<FlatList
				data={records}
				keyExtractor={(item) => item.exerciseId}
				ListEmptyComponent={<Text style={styles.empty}>{tt('records.empty')}</Text>}
				contentContainerStyle={{ gap: 8 }}
				renderItem={({ item }) => (
					<View style={styles.row}>
						<Text style={styles.title}>{exerciseDisplayName(item.exerciseId, locale)}</Text>
						<Text style={styles.meta}>
							{item.weightKg != null ? `${item.weightKg} ${tt('common.kg')}` : '-'} ×{' '}
							{item.reps ?? '-'} {tt('common.reps')}
						</Text>
					</View>
				)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 16, backgroundColor: colors.bg },
	empty: { color: colors.muted, textAlign: 'center', marginTop: 48 },
	row: {
		minHeight: touchMin,
		backgroundColor: colors.panel,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 14
	},
	title: { color: colors.text, fontWeight: '700' },
	meta: { color: colors.muted, marginTop: 4, fontVariant: ['tabular-nums'] }
});
