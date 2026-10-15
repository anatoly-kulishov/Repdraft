import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
	completedExerciseCount,
	completedSetCount,
	sessionDurationMs,
	sessionVolumeKg
} from '@repdraft/domain/session';
import type { WorkoutSession } from '@repdraft/domain/types';
import { heroLevel } from '@repdraft/domain/quest';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useLocale } from '../../src/state/locale';
import { isQuestEnabled, loadQuestState } from '../../src/state/quest';
import { sessionsRepo } from '../../src/storage/sessionsRepo';
import { colors } from '../../src/theme';

function formatDuration(ms: number): string {
	const totalSec = Math.max(0, Math.round(ms / 1000));
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SummaryScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const { tt } = useLocale();
	const [session, setSession] = useState<WorkoutSession | null>(null);
	const [questLine, setQuestLine] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const found = id ? await sessionsRepo.get(id) : null;
			if (!cancelled) setSession(found);
			if (await isQuestEnabled()) {
				const st = await loadQuestState();
				if (!cancelled) {
					setQuestLine(
						`${tt('quest.summaryTitle')}: Lv ${heroLevel(st.hero.totalXp)} · ${st.week.countedSessionIds.length}/${st.weeklyGoal}`
					);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [id, tt]);

	if (!session) {
		return (
			<View style={styles.center}>
				<ActivityIndicator color={colors.accent} />
			</View>
		);
	}

	return (
		<View style={styles.root}>
			<Text style={styles.kicker}>{tt('summary.saved')}</Text>
			<Text style={styles.title}>{session.planName}</Text>
			{questLine ? <Text style={styles.quest}>{questLine}</Text> : null}
			<View style={styles.stats}>
				<View style={styles.stat}>
					<Text style={styles.statLabel}>{tt('summary.time')}</Text>
					<Text style={styles.statValue}>{formatDuration(sessionDurationMs(session) ?? 0)}</Text>
				</View>
				<View style={styles.stat}>
					<Text style={styles.statLabel}>{tt('common.exercises')}</Text>
					<Text style={styles.statValue}>{completedExerciseCount(session)}</Text>
				</View>
				<View style={styles.stat}>
					<Text style={styles.statLabel}>{tt('summary.sets')}</Text>
					<Text style={styles.statValue}>{completedSetCount(session)}</Text>
				</View>
				<View style={styles.stat}>
					<Text style={styles.statLabel}>{tt('summary.volume')}</Text>
					<Text style={styles.statValue}>{Math.round(sessionVolumeKg(session))}</Text>
				</View>
			</View>
			<View style={styles.footer}>
				<PrimaryButton label={tt('summary.back')} onPress={() => router.replace('/')} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, padding: 16, gap: 12, backgroundColor: colors.bg },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
	kicker: { color: colors.accent, fontWeight: '700', fontSize: 14 },
	title: { color: colors.text, fontSize: 28, fontWeight: '800' },
	quest: { color: colors.muted },
	stats: { flexDirection: 'row', gap: 10, marginTop: 8 },
	stat: {
		flex: 1,
		backgroundColor: colors.panel,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: colors.border,
		padding: 14
	},
	statLabel: { color: colors.muted, fontSize: 12 },
	statValue: {
		color: colors.text,
		fontSize: 22,
		fontWeight: '800',
		marginTop: 6,
		fontVariant: ['tabular-nums']
	},
	footer: { marginTop: 'auto' }
});
