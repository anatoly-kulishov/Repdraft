import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
	Image,
	Linking,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View
} from 'react-native';
import { lastPerformance, recentExerciseLogs } from '@repdraft/domain/session';
import type { PersonalRecord, WorkoutSession } from '@repdraft/domain/types';
import {
	exerciseDisplayName,
	getIndexItem,
	refreshCustomsCache
} from '../../src/catalog/loadIndex';
import { catalogMediaUrl, webOrigin } from '../../src/catalog/mediaUrl';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useLocale } from '../../src/state/locale';
import { bookmarksRepo } from '../../src/storage/bookmarksRepo';
import { recordsRepo } from '../../src/storage/recordsRepo';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { colors, touchMin } from '../../src/theme';

export default function ExerciseDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const { locale, tt } = useLocale();
	const [bookmarked, setBookmarked] = useState(false);
	const [record, setRecord] = useState<PersonalRecord | null>(null);
	const [history, setHistory] = useState<WorkoutSession[]>([]);
	const [itemTick, setItemTick] = useState(0);

	useEffect(() => {
		void (async () => {
			await refreshCustomsCache();
			setItemTick((n) => n + 1);
			if (!id) return;
			setBookmarked(await bookmarksRepo.has(id));
			setRecord(await recordsRepo.get(id));
			setHistory(await sessionsRepo.list());
		})();
	}, [id]);

	void itemTick;
	const item = id ? getIndexItem(id) : null;
	const imageUri = catalogMediaUrl(item?.image);
	const prev = id ? lastPerformance(history, id) : null;
	const recent = id ? recentExerciseLogs(history, id, 8) : [];

	return (
		<ScrollView contentContainerStyle={styles.root}>
			<Text style={styles.title}>{id ? exerciseDisplayName(id, locale) : tt('exercise.detail')}</Text>
			{item ? (
				<Text style={styles.meta}>
					{item.body_part} · {item.equipment}
					{item.target ? ` · ${item.target}` : ''}
				</Text>
			) : null}
			{imageUri ? (
				<Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
			) : null}
			<PrimaryButton
				label={bookmarked ? '★ ' + tt('exercises.saved') : '☆ ' + tt('exercises.bookmark')}
				variant={bookmarked ? 'primary' : 'ghost'}
				onPress={() => {
					if (!id) return;
					void bookmarksRepo.toggle(id).then(setBookmarked);
				}}
			/>
			{record ? (
				<View style={styles.card}>
					<Text style={styles.cardTitle}>{tt('records.title')}</Text>
					<Text style={styles.line}>
						{record.weightKg != null ? `${record.weightKg} ${tt('common.kg')}` : '-'} ×{' '}
						{record.reps ?? '-'} {tt('common.reps')}
					</Text>
				</View>
			) : null}
			{prev ? (
				<View style={styles.card}>
					<Text style={styles.cardTitle}>{tt('live.last')}</Text>
					<Text style={styles.line}>
						{prev.weightKg ?? '-'} {tt('common.kg')} × {prev.reps ?? '-'}
					</Text>
				</View>
			) : null}
			{recent.length > 0 ? (
				<View style={styles.card}>
					<Text style={styles.cardTitle}>{tt('history.title')}</Text>
					{recent.map((row) => {
						const top = row.sets[0];
						return (
							<Pressable
								key={row.sessionId}
								style={styles.histRow}
								onPress={() => router.push(`/history/${row.sessionId}`)}
							>
								<Text style={styles.line}>
									{row.finishedAt.slice(0, 10)} · {row.sets.length} sets
									{top
										? ` · ${top.weightKg ?? '-'} × ${top.reps ?? '-'}`
										: ''}
								</Text>
							</Pressable>
						);
					})}
				</View>
			) : null}
			{id ? (
				<PrimaryButton
					label={tt('exercise.instructions')}
					variant="ghost"
					onPress={() => void Linking.openURL(`${webOrigin()}/exercise/${id}`)}
				/>
			) : null}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	root: { padding: 16, gap: 12, backgroundColor: colors.bg, paddingBottom: 40 },
	title: { color: colors.text, fontSize: 24, fontWeight: '800' },
	meta: { color: colors.muted },
	image: {
		width: '100%',
		height: 220,
		borderRadius: 14,
		backgroundColor: colors.panel,
		borderWidth: 1,
		borderColor: colors.border
	},
	card: {
		backgroundColor: colors.panel,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 14,
		gap: 6
	},
	cardTitle: { color: colors.text, fontWeight: '700' },
	line: { color: colors.muted, fontVariant: ['tabular-nums'] },
	histRow: { minHeight: touchMin, justifyContent: 'center' }
});
