import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View
} from 'react-native';
import { lastPerformance, recentExerciseLogs } from '@repdraft/domain/session';
import type { PersonalRecord, WorkoutSession } from '@repdraft/domain/types';
import { labelBodyPart } from '@repdraft/domain/labels.ru';
import { addExercise, createEmptyDraft } from '@repdraft/domain/workout';
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
import { TechniqueSheet } from '../../src/components/TechniqueSheet';
import { routeParam } from '../../src/nav/params';
import { useLocale } from '../../src/state/locale';
import { bookmarksRepo } from '../../src/storage/bookmarksRepo';
import { plansRepo } from '../../src/storage/plansRepo';
import { recordsRepo } from '../../src/storage/recordsRepo';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { pushPlan } from '../../src/sync/cloudSync';
import { useBottomChromePad } from '../../src/layout/safe';
import { useAppColors } from '../../src/state/theme';
import { radius, space, touchMin, type ColorPalette } from '../../src/theme';

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
	const [sheetOpen, setSheetOpen] = useState(false);
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

	async function addToPlan(planId: string | 'new') {
		if (!id || !item) return;
		try {
			let plan =
				planId === 'new'
					? createEmptyDraft(tt('workouts.newName'))
					: await plansRepo.get(planId);
			if (!plan) {
				Alert.alert(tt('builder.loadFail'));
				return;
			}
			const { plan: next, added } = addExercise(plan, id, {
				name: item.name,
				equipment: item.equipment
			});
			if (!added) {
				Alert.alert(tt('builder.alreadyInPlan'));
				router.push(`/builder/${plan.id}`);
				return;
			}
			await plansRepo.save(next);
			try {
				await pushPlan(next);
			} catch {
				/* offline */
			}
			router.push(`/builder/${next.id}`);
		} catch {
			Alert.alert(tt('builder.saveFail'));
		}
	}

	function offerAddToPlan() {
		void (async () => {
			const plans = await plansRepo.list();
			const buttons: {
				text: string;
				style?: 'cancel' | 'destructive' | 'default';
				onPress?: () => void;
			}[] = [{ text: tt('common.cancel'), style: 'cancel' }];
			buttons.push({
				text: tt('workouts.create'),
				onPress: () => void addToPlan('new')
			});
			for (const p of plans.slice(0, 6)) {
				buttons.push({
					text: p.name || tt('workouts.newName'),
					onPress: () => void addToPlan(p.id)
				});
			}
			Alert.alert(tt('exercises.add'), undefined, buttons);
		})();
	}

	return (
		<>
			<ScrollView contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}>
				<Text style={styles.title} numberOfLines={2}>
					{id ? exerciseDisplayName(id, locale) : tt('exercise.detail')}
				</Text>
				{item ? (
					<Text style={styles.meta} numberOfLines={2}>
						{labelBodyPart(item.body_part, locale)} · {item.equipment}
						{item.target ? ` · ${item.target}` : ''}
					</Text>
				) : null}
				<Pressable onPress={() => setSheetOpen(true)}>
					<CatalogThumb imagePath={imagePath} bannerHeight={220} rounded={radius.md} />
				</Pressable>
				<PrimaryButton label={tt('exercises.add')} onPress={offerAddToPlan} />
				<PrimaryButton
					label={bookmarked ? '★ ' + tt('exercises.saved') : '☆ ' + tt('exercises.bookmark')}
					variant={bookmarked ? 'primary' : 'ghost'}
					onPress={() => {
						if (!id) return;
						void bookmarksRepo.toggle(id).then(setBookmarked);
					}}
				/>
				<PrimaryButton
					label={tt('exercise.technique')}
					variant="ghost"
					onPress={() => setSheetOpen(true)}
				/>
				{steps.length > 0 ? (
					<View style={styles.card}>
						<Text style={styles.cardTitle}>{tt('exercise.steps')}</Text>
						{steps.map((step, i) => (
							<Text key={i} style={styles.step}>
								{i + 1}. {step}
							</Text>
						))}
					</View>
				) : null}
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
			</ScrollView>
			<TechniqueSheet
				exerciseId={sheetOpen && id ? id : null}
				onClose={() => setSheetOpen(false)}
			/>
		</>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
	root: { padding: space.lg, gap: space.md, backgroundColor: colors.bg },
	title: { color: colors.text, fontSize: 24, fontWeight: '800' },
	meta: { color: colors.muted },
	card: {
		backgroundColor: colors.panel,
		borderRadius: radius.md,
		borderWidth: 1,
		borderColor: colors.border,
		padding: space.md,
		gap: 6
	},
	cardTitle: { color: colors.text, fontWeight: '700' },
	line: { color: colors.muted, fontVariant: ['tabular-nums'] },
	step: { color: colors.text, fontSize: 15, lineHeight: 22 },
	histRow: { minHeight: touchMin, justifyContent: 'center' }
	});
}
