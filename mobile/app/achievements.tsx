import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
	countableFinishedSessions,
	type AchievementsState
} from '@repdraft/domain/achievements';
import type { WorkoutSession } from '@repdraft/domain/types';
import { AchievementsPanel } from '../src/components/AchievementsPanel';
import { useBottomChromePad } from '../src/layout/safe';
import { loadAchievementsState } from '../src/state/achievements';
import { useAppColors } from '../src/state/theme';
import { sessionsRepo } from '../src/storage/sessionsRepo';
import { space, type ColorPalette } from '../src/theme';

export default function AchievementsScreen() {
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

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<AchievementsPanel state={state} finishedSessions={finished} showFilters />
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: space.md },
		center: { flex: 1, backgroundColor: colors.bg }
	});
}
