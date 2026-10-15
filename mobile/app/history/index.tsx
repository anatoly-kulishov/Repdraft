import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { completedSetCount } from '@repdraft/domain/session';
import type { WorkoutSession } from '@repdraft/domain/types';
import { useLocale } from '../../src/state/locale';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { colors, touchMin } from '../../src/theme';

export default function HistoryListScreen() {
	const router = useRouter();
	const { tt } = useLocale();
	const [sessions, setSessions] = useState<WorkoutSession[]>([]);

	useFocusEffect(
		useCallback(() => {
			void sessionsRepo.list().then(setSessions);
		}, [])
	);

	return (
		<View style={styles.root}>
			<FlatList
				data={sessions.filter((s) => s.finishedAt)}
				keyExtractor={(item) => item.id}
				ListEmptyComponent={<Text style={styles.empty}>{tt('history.empty')}</Text>}
				contentContainerStyle={{ gap: 8, flexGrow: 1 }}
				renderItem={({ item }) => (
					<Pressable style={styles.row} onPress={() => router.push(`/history/${item.id}`)}>
						<Text style={styles.title}>{item.planName}</Text>
						<Text style={styles.meta}>
							{(item.finishedAt ?? item.startedAt).slice(0, 10)} ·{' '}
							{completedSetCount(item)} {tt('history.setsCount')}
						</Text>
					</Pressable>
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
	title: { color: colors.text, fontWeight: '700', fontSize: 16 },
	meta: { color: colors.muted, marginTop: 4 }
});
