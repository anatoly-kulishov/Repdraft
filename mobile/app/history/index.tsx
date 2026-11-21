import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
	Alert,
	Pressable,
	SectionList,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import { Star, Trash2 } from 'lucide-react-native';
import { HISTORY_PAGE_SIZE } from '@repdraft/domain/home';
import { completedSetCount, sessionDurationMs } from '@repdraft/domain/session';
import { groupSessionsByLocalDay } from '@repdraft/domain/sessionHistory';
import type { WorkoutSession } from '@repdraft/domain/types';
import { formatDurationMinutes, formatRelativeDay } from '@repdraft/i18n/format';
import { translatePlural } from '@repdraft/i18n/messages';
import { Chip } from '../../src/components/Chip';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useLocale } from '../../src/state/locale';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { sessionRatingsRepo } from '../../src/storage/sessionRatingsRepo';
import { deleteSessionRemote } from '../../src/sync/cloudSync';
import { useBottomChromePad } from '../../src/layout/safe';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../../src/theme';

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
	const [ratings, setRatings] = useState<Record<string, number>>({});
	const [query, setQuery] = useState('');
	const [preset, setPreset] = useState<Preset>('all');
	const [visibleLimit, setVisibleLimit] = useState(HISTORY_PAGE_SIZE);

	const reload = useCallback(() => {
		void sessionsRepo.list().then(setSessions);
		void sessionRatingsRepo.all().then((all) => {
			const next: Record<string, number> = {};
			for (const [id, entry] of Object.entries(all)) next[id] = entry.stars;
			setRatings(next);
		});
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

	const visible = useMemo(
		() => filtered.slice(0, visibleLimit),
		[filtered, visibleLimit]
	);

	const sections = useMemo(
		() =>
			groupSessionsByLocalDay(visible).map((g) => ({
				title: formatRelativeDay(g.dayIso, locale),
				data: g.sessions
			})),
		[visible, locale]
	);

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

	function confirmClear() {
		Alert.alert(tt('workouts.clearHistory'), tt('workouts.confirmClearHistory'), [
			{ text: tt('common.cancel'), style: 'cancel' },
			{
				text: tt('workouts.clearHistory'),
				style: 'destructive',
				onPress: () => {
					void (async () => {
						/* Same contract as web: finished entries go, an unfinished session stays. */
						const finished = sessions.filter((s) => s.finishedAt);
						for (const item of finished) {
							await sessionsRepo.remove(item.id);
							try {
								await deleteSessionRemote(item.id);
							} catch {
								/* offline: local delete is enough */
							}
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

	const emptyAll = sessions.filter((s) => s.finishedAt).length === 0;

	const finishedCount = sessions.filter((s) => s.finishedAt).length;

	return (
		<View style={styles.root}>
			<Stack.Screen
				options={{
					headerRight: () =>
						finishedCount > 0 ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={tt('workouts.clearHistory')}
								hitSlop={8}
								onPress={confirmClear}
								style={styles.headerBtn}
							>
								<Trash2 color={colors.muted} size={20} strokeWidth={2.2} />
							</Pressable>
						) : null
				}}
			/>
			<TextInput
				value={query}
				onChangeText={(v) => {
					setQuery(v);
					setVisibleLimit(HISTORY_PAGE_SIZE);
				}}
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
						onPress={() => {
							setPreset(p.id);
							setVisibleLimit(HISTORY_PAGE_SIZE);
						}}
					/>
				))}
			</View>
			<SectionList
				style={{ flex: 1 }}
				sections={sections}
				keyExtractor={(item) => item.id}
				stickySectionHeadersEnabled={false}
				onEndReached={() => {
					if (visibleLimit < filtered.length) {
						setVisibleLimit((n) => n + HISTORY_PAGE_SIZE);
					}
				}}
				onEndReachedThreshold={0.4}
				ListEmptyComponent={
					<View style={styles.emptyWrap}>
						<Text style={styles.empty}>
							{emptyAll ? tt('workouts.historyEmptyTitle') : tt('history.empty')}
						</Text>
						{emptyAll ? (
							<>
								<Text style={styles.emptyLead}>{tt('onboarding.historyEmptyLead')}</Text>
								<PrimaryButton
									label={tt('home.startWorkout')}
									onPress={() => router.push('/(tabs)/workouts')}
								/>
							</>
						) : null}
					</View>
				}
				contentContainerStyle={{ gap: space.sm, flexGrow: 1, paddingBottom: listPad }}
				renderSectionHeader={({ section }) => (
					<Text style={styles.sectionDay}>{section.title}</Text>
				)}
				renderItem={({ item }) => {
					const mins = formatDurationMinutes(sessionDurationMs(item));
					const sets = completedSetCount(item);
					const stars = ratings[item.id] ?? null;
					return (
						<Pressable
							style={styles.row}
							onPress={() => router.push(`/history/${item.id}`)}
							onLongPress={() => confirmDelete(item)}
						>
							<Text style={styles.title} numberOfLines={2}>
								{item.planName}
							</Text>
							<View style={styles.metaRow}>
								<Text style={styles.meta} numberOfLines={1}>
									{translatePlural(locale, 'workouts.historyMeta', sets, {
										min: mins ?? '-',
										sets
									})}
								</Text>
								{stars ? (
									<View
										style={styles.rating}
										accessibilityLabel={tt('rating.rowLabel', { n: stars })}
									>
										<Star size={11} color={colors.accentText} fill={colors.accentText} />
										<Text style={styles.ratingText}>{stars}</Text>
									</View>
								) : null}
							</View>
						</Pressable>
					);
				}}
			/>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: { flex: 1, padding: space.lg, backgroundColor: colors.bg, gap: space.sm },
		search: {
			minHeight: touchMin,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.panel,
			color: colors.text,
			paddingHorizontal: space.md,
			fontFamily: fontFamily.regular
		},
		chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
		headerBtn: {
			minWidth: 44,
			minHeight: 44,
			alignItems: 'center',
			justifyContent: 'center',
			paddingHorizontal: space.md
		},
		emptyWrap: { alignItems: 'center', gap: space.md, marginTop: 48, paddingHorizontal: space.lg },
		empty: {
			color: colors.text,
			textAlign: 'center',
			fontWeight: '700',
			fontSize: 16,
			fontFamily: fontFamily.bold
		},
		emptyLead: { color: colors.muted, textAlign: 'center', fontFamily: fontFamily.regular },
		sectionDay: {
			color: colors.muted,
			fontSize: 13,
			fontWeight: '600',
			marginTop: space.sm,
			marginBottom: space.xs,
			fontFamily: fontFamily.semibold
		},
		row: {
			minHeight: touchMin,
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.md
		},
		title: { color: colors.text, fontWeight: '700', fontSize: 16, fontFamily: fontFamily.bold },
		meta: { color: colors.muted, marginTop: 4, fontFamily: fontFamily.regular },
		metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 4 },
		rating: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 2,
			paddingHorizontal: 5,
			paddingVertical: 1,
			borderRadius: 999,
			backgroundColor: colors.accentDim
		},
		ratingText: {
			color: colors.accentText,
			fontSize: 11,
			fontWeight: '600',
			fontFamily: fontFamily.regular
		}
	});
}
