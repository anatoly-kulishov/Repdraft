import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
	countableFinishedSessions,
	type AchievementsState
} from '@repdraft/domain/achievements';
import type { WorkoutSession } from '@repdraft/domain/types';
import { AchievementsPanel } from '../src/components/AchievementsPanel';
import { useBottomChromePad } from '../src/layout/safe';
import { loadAchievementsState } from '../src/state/achievements';
import { useLocale } from '../src/state/locale';
import { useAppColors } from '../src/state/theme';
import { sessionsRepo } from '../src/storage/sessionsRepo';
import { space, type ColorPalette } from '../src/theme';

export default function AchievementsScreen() {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const [state, setState] = useState<AchievementsState | null>(null);
	const [sessions, setSessions] = useState<WorkoutSession[]>([]);

	useFocusEffect(
		useCallback(() => {
			void (async () => {
				const [st, list] = await Promise.all([
					loadAchievementsState(),
					sessionsRepo.list()
				]);
				setState(st);
				setSessions(list);
			})();
		}, [])
	);

	if (!state) {
		return <View style={styles.center} />;
	}

	const finished = countableFinishedSessions(sessions);
	const unlocked = state.unlocked.length;

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<Text style={styles.meta}>
				{tt('achievements.progressCount', {
					n: String(unlocked),
					total: String(5)
				})}
			</Text>
			<AchievementsPanel
				state={state}
				finishedSessions={finished}
				showFilters
			/>
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: space.md },
		center: { flex: 1, backgroundColor: colors.bg },
		meta: { color: colors.muted, fontSize: 15, fontWeight: '600' }
	});
}
