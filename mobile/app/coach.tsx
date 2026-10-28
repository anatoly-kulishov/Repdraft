import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildCoachHints, suggestPlanReplace } from '@repdraft/domain/coachHints';
import { computeProgressOverview } from '@repdraft/domain/progressOverview';
import { labelBodyPart } from '@repdraft/domain/labels.ru';
import type { WorkoutPlan, WorkoutSession } from '@repdraft/domain/types';
import {
	exerciseDisplayName,
	getIndexItem,
	loadExerciseIndex,
	refreshCustomsCache
} from '../src/catalog/loadIndex';
import { Panel } from '../src/components/Panel';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { readHomeNextPlanId } from '../src/live/homeNext';
import { appendExerciseToHomePlan, replaceExerciseInHomePlan } from '../src/lib/planPatch';
import { useBottomChromePad } from '../src/layout/safe';
import { useLocale } from '../src/state/locale';
import { useAppColors } from '../src/state/theme';
import { plansRepo } from '../src/storage/plansRepo';
import { sessionsRepo } from '../src/storage/sessionsRepo';
import { fontFamily, space, type ColorPalette } from '../src/theme';

export default function CoachScreen() {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const [sessions, setSessions] = useState<WorkoutSession[]>([]);
	const [homePlan, setHomePlan] = useState<WorkoutPlan | null>(null);

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				await refreshCustomsCache();
				const [list, plans, pinned] = await Promise.all([
					sessionsRepo.list(),
					plansRepo.list(),
					readHomeNextPlanId()
				]);
				setSessions(list);
				setHomePlan((pinned ? plans.find((p) => p.id === pinned) : null) ?? plans[0] ?? null);
			})();
		}, [])
	);

	const overview = useMemo(
		() => computeProgressOverview(sessions, new Date(), (id) => getIndexItem(id)?.body_part ?? null),
		[sessions]
	);
	const replace = useMemo(() => {
		if (!homePlan || !overview.laggingBodyPart) return null;
		return suggestPlanReplace(
			homePlan.exercises.map((ex) => ex.exerciseId),
			[overview.laggingBodyPart],
			loadExerciseIndex(),
			(id) => getIndexItem(id)?.body_part ?? null
		);
	}, [homePlan, overview.laggingBodyPart]);

	const replaceSharePct = useMemo(
		() =>
			replace
				? (overview.bodyParts.find((part) => part.bodyPart === replace.bodyPart)?.sharePct ??
					null)
				: null,
		[replace, overview.bodyParts]
	);

	const hints = useMemo(() => {
		const finished = sessions
			.filter((s) => s.finishedAt)
			.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
		const focus = finished[0];
		if (!focus) return [];
		const catalog = loadExerciseIndex();
		const bodyPartFor = (id: string) => getIndexItem(id)?.body_part ?? null;
		return buildCoachHints(focus, finished, catalog, bodyPartFor);
	}, [sessions]);

	async function replaceHint() {
		if (!replace) return;
		const planId = await replaceExerciseInHomePlan(replace.fromExerciseId, replace.toExerciseId);
		if (!planId) {
			Alert.alert(tt('common.error'), tt('coach.noPlan'));
			return;
		}
		router.push(`/builder/${planId}`);
	}

	async function addHint(exerciseId: string) {
		const planId = await appendExerciseToHomePlan(exerciseId);
		if (!planId) {
			Alert.alert(tt('common.error'), tt('coach.noPlan'));
			return;
		}
		router.push(`/builder/${planId}`);
	}

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<Text style={styles.lead}>{tt('coach.lead')}</Text>
			<Text style={styles.lead}>{tt('coach.reviewed', { n: String(overview.workouts30d) })}</Text>
			{hints.length === 0 && !replace ? (
				<Panel>
					<Text style={styles.muted}>{tt('coach.empty')}</Text>
					<PrimaryButton
						label={tt('coach.emptyCta')}
						onPress={() => router.push('/')}
					/>
				</Panel>
			) : (
				<>
					{hints.map((hint) => (
						<Panel key={hint.id}>
							<Text style={styles.title}>{exerciseDisplayName(hint.exerciseId, locale)}</Text>
							<Text style={styles.meta}>
								{labelBodyPart(hint.bodyPart, locale)} · {tt(hint.reasonKey)}
							</Text>
							<PrimaryButton
								label={tt('coach.addToPlan')}
								onPress={() => void addHint(hint.exerciseId)}
							/>
						</Panel>
					))}
					{replace ? (
						<Panel>
							<Text style={styles.title}>{exerciseDisplayName(replace.fromExerciseId, locale)}</Text>
							<Text style={styles.meta}>→ {exerciseDisplayName(replace.toExerciseId, locale)}</Text>
							<Text style={styles.meta}>{labelBodyPart(replace.bodyPart, locale)}</Text>
							<Text style={styles.why}>
								{replaceSharePct != null
									? tt('coach.replaceWhy', {
											part: labelBodyPart(replace.bodyPart, locale),
											pct: replaceSharePct
										})
									: tt('coach.replaceWhyGeneric')}
							</Text>
							<Text style={styles.why}>{tt('coach.replaceWhat')}</Text>
							<PrimaryButton label={tt('coach.replace')} onPress={() => void replaceHint()} />
						</Panel>
					) : null}
				</>
			)}
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: space.md },
		lead: { color: colors.muted, fontSize: 15, lineHeight: 21, fontFamily: fontFamily.regular },
		title: { color: colors.text, fontWeight: '800', fontSize: 17, fontFamily: fontFamily.extrabold },
		meta: { color: colors.muted, fontSize: 14, marginBottom: space.sm, fontFamily: fontFamily.regular },
		why: {
			color: colors.muted,
			fontSize: 13,
			lineHeight: 18,
			marginBottom: space.sm,
			fontFamily: fontFamily.regular
		},
		muted: { color: colors.muted, lineHeight: 20, fontFamily: fontFamily.regular }
	});
}
