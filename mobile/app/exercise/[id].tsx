import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bookmark } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { lastPerformance, recentExerciseLogs } from '@repdraft/domain/session';
import type { PersonalRecord, WorkoutSession } from '@repdraft/domain/types';
import {
	labelBodyPart,
	labelEquipment,
	labelTarget
} from '@repdraft/domain/labels.ru';
import {
	fetchExerciseDetail,
	stepsForLocale,
	type ExerciseDetailPayload
} from '../../src/catalog/fetchExerciseDetail';
import {
	exerciseDisplayName,
	getIndexItem,
	refreshCustomsCache
} from '../../src/catalog/loadIndex';
import { CatalogThumb } from '../../src/components/CatalogThumb';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { routeParam } from '../../src/nav/params';
import { useAddToPlan } from '../../src/plan/useAddToPlan';
import { useLocale } from '../../src/state/locale';
import { bookmarksRepo } from '../../src/storage/bookmarksRepo';
import { recordsRepo } from '../../src/storage/recordsRepo';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { useBottomChromePad } from '../../src/layout/safe';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, radius, space, touchMin, type, type ColorPalette } from '../../src/theme';

export default function ExerciseDetailScreen() {
	const { id: idParam } = useLocalSearchParams<{ id: string }>();
	const id = routeParam(idParam);
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const [bookmarked, setBookmarked] = useState(false);
	const [record, setRecord] = useState<PersonalRecord | null>(null);
	const [history, setHistory] = useState<WorkoutSession[]>([]);
	const [detail, setDetail] = useState<ExerciseDetailPayload | null>(null);
	const [itemTick, setItemTick] = useState(0);

	useEffect(() => {
		void (async () => {
			await refreshCustomsCache();
			setItemTick((n) => n + 1);
			if (!id) return;
			setBookmarked(await bookmarksRepo.has(id));
			setRecord(await recordsRepo.get(id));
			setHistory(await sessionsRepo.list());
			setDetail(await fetchExerciseDetail(id));
		})();
	}, [id]);

	void itemTick;
	const item = id ? getIndexItem(id) : null;
	const imagePath = detail?.image ?? item?.image;
	const prev = id ? lastPerformance(history, id) : null;
	const recent = id ? recentExerciseLogs(history, id, 8) : [];
	const steps = stepsForLocale(detail, locale);
	const { offerAddToPlan, sheet: addToPlanSheet } = useAddToPlan();
	const [tab, setTab] = useState<'description' | 'history' | 'record' | 'muscles'>('description');
	const tabs = [
		{ id: 'description' as const, label: tt('exercise.tabDescription') },
		{ id: 'history' as const, label: tt('exercise.tabHistory') },
		{ id: 'record' as const, label: tt('exercise.tabRecord') },
		{ id: 'muscles' as const, label: tt('exercise.tabMuscles') }
	];

	return (
		<>
		<View style={styles.screen}>
		<ScrollView contentContainerStyle={[styles.root, { paddingBottom: space.lg }]}>
				<Text style={styles.title} numberOfLines={2}>
					{id ? exerciseDisplayName(id, locale) : tt('exercise.detail')}
				</Text>
				{item ? (
					<Text style={styles.meta} numberOfLines={2}>
						{labelBodyPart(item.body_part, locale)} · {labelEquipment(item.equipment, locale)}
						{item.target ? ` · ${labelTarget(item.target, locale)}` : ''}
					</Text>
				) : null}
				<View>
					<CatalogThumb
						imagePath={imagePath}
						bannerHeight={220}
						rounded={radius.md}
						whitePlate
					/>
				</View>
				<Pressable
					accessibilityRole="button"
					accessibilityState={{ selected: bookmarked }}
					style={({ pressed }) => [styles.bookmarkBtn, pressed && styles.pressed]}
					onPress={() => {
						if (!id) return;
						void bookmarksRepo.toggle(id).then(setBookmarked);
					}}
				>
				<Bookmark
					color={bookmarked ? colors.accent : colors.text}
					size={20}
					strokeWidth={2}
					fill={bookmarked ? colors.accent : 'transparent'}
				/>
					<Text
						style={[
							styles.bookmarkLabel,
							{ color: bookmarked ? colors.accent : colors.text }
						]}
					>
						{bookmarked ? tt('exercises.saved') : tt('exercises.bookmark')}
					</Text>
				</Pressable>
				<View style={styles.tabs} accessibilityRole="tablist">
					{tabs.map((item) => {
						const on = tab === item.id;
						return (
							<Pressable
								key={item.id}
								accessibilityRole="tab"
								accessibilityState={{ selected: on }}
								style={[styles.tab, on && styles.tabOn]}
								onPress={() => setTab(item.id)}
							>
								<Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
									{item.label}
								</Text>
							</Pressable>
						);
					})}
				</View>
				{tab === 'description' ? (
					steps.length > 0 ? (
						<View style={styles.card}>
							<Text style={styles.cardTitle}>{tt('exercise.howTo')}</Text>
							{steps.map((step, i) => (
								<Text key={i} style={styles.step}>
									{i + 1}. {step}
								</Text>
							))}
						</View>
					) : (
						<Text style={styles.line}>{tt('exercise.dash')}</Text>
					)
				) : null}
				{tab === 'history' ? (
					recent.length > 0 ? (
						<View style={styles.card}>
							<Text style={styles.cardTitle}>{tt('exercise.historyTitle')}</Text>
							{prev ? (
								<Text style={styles.line}>
									{tt('live.last')}: {prev.weightKg ?? '-'} {tt('common.kg')} × {prev.reps ?? '-'}
								</Text>
							) : null}
							{recent.map((row) => {
								const top = row.sets[0];
								return (
									<Pressable
										key={row.sessionId}
										style={styles.histRow}
										onPress={() => router.push(`/history/${row.sessionId}`)}
									>
										<Text style={styles.line}>
											{row.finishedAt.slice(0, 10)} · {row.sets.length}{' '}
											{tt('history.setsCount')}
											{top ? ` · ${top.weightKg ?? '-'} × ${top.reps ?? '-'}` : ''}
										</Text>
									</Pressable>
								);
							})}
						</View>
					) : (
						<Text style={styles.line}>{tt('exercise.historyEmpty')}</Text>
					)
				) : null}
				{tab === 'record' ? (
					<View style={styles.card}>
						<Text style={styles.cardTitle}>{tt('records.title')}</Text>
						{record ? (
							<Text style={styles.line}>
								{record.weightKg != null ? `${record.weightKg} ${tt('common.kg')}` : '-'} ×{' '}
								{record.reps ?? '-'} {tt('common.reps')}
							</Text>
						) : (
							<Text style={styles.line}>{tt('exercise.dash')}</Text>
						)}
					</View>
				) : null}
				{tab === 'muscles' && item ? (
					<View style={styles.card}>
						<Text style={styles.line}>
							{tt('exercise.bodyPart')}: {labelBodyPart(item.body_part, locale)}
						</Text>
						<Text style={styles.line}>
							{tt('exercise.equipment')}: {labelEquipment(item.equipment, locale)}
						</Text>
						<Text style={styles.line}>
							{tt('exercise.target')}: {labelTarget(item.target, locale)}
						</Text>
						<Text style={styles.line}>
							{tt('exercise.secondary')}:{' '}
							{item.secondary_muscles.length
								? item.secondary_muscles.map((m) => labelTarget(m, locale)).join(', ')
								: tt('exercise.dash')}
						</Text>
					</View>
				) : null}
		</ScrollView>
		<View style={[styles.footer, { paddingBottom: bottomPad }]}>
			<PrimaryButton
				label={tt('exercises.add')}
				onPress={() => item && offerAddToPlan(item)}
				disabled={!item}
			/>
		</View>
		</View>
		{addToPlanSheet}
		</>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
	screen: { flex: 1, backgroundColor: colors.bg },
	root: { padding: space.lg, gap: space.md, backgroundColor: colors.bg },
	title: { color: colors.text, fontSize: 24, fontWeight: '800', fontFamily: fontFamily.extrabold },
	meta: { color: colors.muted },
	card: {
		backgroundColor: colors.panel,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		padding: space.md,
		gap: 6
	},
	cardTitle: { color: colors.text, fontWeight: '700', fontFamily: fontFamily.bold },
	line: { color: colors.muted, fontVariant: ['tabular-nums'] },
		step: { color: colors.text, fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular },
	histRow: { minHeight: touchMin, justifyContent: 'center' },
	bookmarkBtn: {
		minHeight: touchMin,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: space.sm,
		borderRadius: radius.xl,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.panel
	},
	bookmarkLabel: { ...type.body, fontWeight: '700', fontFamily: fontFamily.bold },
	footer: {
		paddingHorizontal: space.lg,
		paddingTop: space.sm,
		borderTopWidth: 1,
		borderTopColor: colors.border,
		backgroundColor: colors.bg
	},
	tabs: {
		flexDirection: 'row',
		backgroundColor: colors.panelRaised,
		borderRadius: radius.pill,
		padding: 4,
		gap: 4
	},
	tab: {
		flex: 1,
		minHeight: touchMin,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: radius.pill,
		paddingHorizontal: 4
	},
	tabOn: { backgroundColor: colors.panel },
	tabText: { color: colors.muted, fontSize: 13, fontWeight: '600', fontFamily: fontFamily.semibold },
	tabTextOn: { color: colors.text, fontFamily: fontFamily.bold },
	pressed: { opacity: 0.85 }
	});
}
