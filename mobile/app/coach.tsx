import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildCoachHints } from '@repdraft/domain/coachHints';
import { labelBodyPart } from '@repdraft/domain/labels.ru';
import type { WorkoutSession } from '@repdraft/domain/types';
import {
	exerciseDisplayName,
	getIndexItem,
	loadExerciseIndex,
	refreshCustomsCache
} from '../src/catalog/loadIndex';
import { Panel } from '../src/components/Panel';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { appendExerciseToHomePlan } from '../src/lib/planPatch';
import { useBottomChromePad } from '../src/layout/safe';
import { useLocale } from '../src/state/locale';
import { useAppColors } from '../src/state/theme';
import { sessionsRepo } from '../src/storage/sessionsRepo';
import { space, type ColorPalette } from '../src/theme';

export default function CoachScreen() {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const [sessions, setSessions] = useState<WorkoutSession[]>([]);

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				await refreshCustomsCache();
				setSessions(await sessionsRepo.list());
			})();
		}, [])
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

	async function addHint(exerciseId: string) {
		const planId = await appendExerciseToHomePlan(exerciseId);
		if (!planId) {
			Alert.alert(tt('common.error'), tt('coach.noPlan'));
			return;
		}
		Alert.alert(tt('common.ok'), tt('coach.added'));
		router.push(`/builder/${planId}`);
	}

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<Text style={styles.lead}>{tt('coach.lead')}</Text>
			{hints.length === 0 ? (
				<Panel>
					<Text style={styles.muted}>{tt('coach.empty')}</Text>
				</Panel>
			) : (
				hints.map((hint) => (
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
				))
			)}
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: space.md },
		lead: { color: colors.muted, fontSize: 15, lineHeight: 21 },
		title: { color: colors.text, fontWeight: '800', fontSize: 17 },
		meta: { color: colors.muted, fontSize: 14, marginBottom: space.sm },
		muted: { color: colors.muted, lineHeight: 20 }
	});
}
