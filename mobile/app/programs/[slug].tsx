import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { labelEquipment } from '@repdraft/domain/labels.ru';
import {
	isSlotDone,
	isSlotStarted,
	programLead,
	programSessionMinutes,
	programTitle,
	programWeeks,
	sessionPrescription,
	sessionSlotKey,
	sessionTitle,
	type ProgramSessionTemplate
} from '@repdraft/domain/programs';
import { EmptyState } from '../../src/components/EmptyState';
import { PageSkeleton } from '../../src/components/PageSkeleton';
import { Panel } from '../../src/components/Panel';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useBottomChromePad } from '../../src/layout/safe';
import { routeParam } from '../../src/nav/params';
import { useProgramDetail } from '../../src/program/usePrograms';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../../src/theme';

export default function ProgramDetailScreen() {
	const { slug: slugParam } = useLocalSearchParams<{ slug: string }>();
	const slug = routeParam(slugParam) ?? '';
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const detail = useProgramDetail(slug);
	const program = detail.program;

	if (detail.loading) {
		return <PageSkeleton variant="home" />;
	}

	if (!program) {
		return (
			<View style={styles.fallback}>
				<EmptyState
					title={tt('programs.missing')}
					actionLabel={tt('programs.title')}
					onAction={() => router.replace('/programs')}
				/>
			</View>
		);
	}

	const minutes = programSessionMinutes(program);
	const time =
		minutes.min === minutes.max
			? tt('programs.sessionMinutes', { n: minutes.min })
			: tt('programs.sessionMinutesRange', { min: minutes.min, max: minutes.max });
	/* Program exists, so progress is computed; the fallback only satisfies the type. */
	const progress = detail.progress ?? { done: 0, total: 0, percent: 0 };

	function renderSession(week: number, session: ProgramSessionTemplate) {
		const prescription = sessionPrescription(session, week);
		const done = isSlotDone(detail.run, week, session.id);
		const started = isSlotStarted(detail.run, week, session.id);
		const planId = detail.run?.slots[sessionSlotKey(week, session.id)]?.planId ?? null;
		const starting = detail.startingKey === `${week}:${session.id}`;
		return (
			<View key={session.id} style={[styles.session, done && styles.sessionDone]}>
				<View style={styles.sessionMain}>
					<Text style={styles.sessionTitle}>{sessionTitle(session, locale)}</Text>
					<Text style={styles.sessionMeta}>
						{tt('programs.prescription', {
							sets: prescription.sets,
							reps: prescription.reps,
							rest: prescription.restSec
						})}
					</Text>
					{started && planId && !done ? (
						<Pressable
							accessibilityRole="link"
							onPress={() => router.push(`/plan/${planId}`)}
							hitSlop={6}
						>
							<Text style={styles.openPlan}>{tt('programs.openPlan')}</Text>
						</Pressable>
					) : null}
				</View>
				{done ? (
					<View style={styles.done}>
						<Check color={colors.success} size={16} strokeWidth={2.4} />
						<Text style={styles.doneText}>{tt('programs.done')}</Text>
					</View>
				) : (
					<PrimaryButton
						compact
						variant="secondary"
						label={starting ? tt('programs.starting') : tt('programs.start')}
						disabled={detail.startingKey !== null}
						onPress={() => void detail.startSession(week, session)}
					/>
				)}
			</View>
		);
	}

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<View style={styles.head}>
				<View style={styles.tags}>
					<Text style={styles.tag}>
						{tt(
							program.level === 'novice'
								? 'programs.levelNovice'
								: 'programs.levelIntermediate'
						)}
					</Text>
					<Text style={styles.tag}>{tt('programs.weeks', { n: program.weeks })}</Text>
					<Text style={styles.tag}>
						{tt('programs.sessionsPerWeek', { n: program.sessions.length })}
					</Text>
					<Text style={styles.tag}>{time}</Text>
				</View>
				<View style={styles.kit} accessibilityLabel={tt('programs.equipmentTitle')}>
					{program.equipment.map((kit) => (
						<Text key={kit} style={styles.kitItem}>
							{labelEquipment(kit, locale)}
						</Text>
					))}
				</View>
				<Text style={styles.lead}>{programLead(program, locale)}</Text>
			</View>

			<Panel style={styles.progress}>
				<View style={styles.progressRow}>
					<Text style={styles.progressText}>
						{tt('programs.progress', {
							done: progress.done,
							total: progress.total
						})}
					</Text>
					<Text style={styles.progressText}>{progress.percent}%</Text>
				</View>
				<View
					style={styles.bar}
					accessibilityRole="progressbar"
					accessibilityValue={{ min: 0, max: progress.total, now: progress.done }}
				>
					<View style={[styles.barFill, { width: `${progress.percent}%` }]} />
				</View>
			</Panel>

			<View style={styles.weeks}>
				{programWeeks(program).map((week) => (
					<View key={week.index} style={styles.week}>
						<Text style={styles.weekTitle}>
							{tt('programs.weekTitle', { n: week.index })}
						</Text>
						{week.sessions.map((session) => renderSession(week.index, session))}
					</View>
				))}
			</View>

			<View style={styles.how}>
				<Text style={styles.howTitle}>{tt('programs.howTitle')}</Text>
				<Text style={styles.howHint}>{tt('programs.how1')}</Text>
				<Text style={styles.howHint}>{tt('programs.how2')}</Text>
				<Text style={styles.howHint}>{tt('programs.how3')}</Text>
				<Text style={styles.note}>{tt('programs.note')}</Text>
				<Text style={styles.note}>{tt('programs.localHint')}</Text>
			</View>
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: space.lg },
		fallback: { flex: 1, backgroundColor: colors.bg },
		head: { gap: space.sm },
		tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
		tag: {
			paddingHorizontal: 8,
			paddingVertical: 2,
			borderRadius: radius.pill,
			backgroundColor: colors.panel,
			color: colors.muted,
			fontSize: 11,
			fontWeight: '600',
			fontFamily: fontFamily.semibold,
			overflow: 'hidden'
		},
		kit: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
		kitItem: {
			paddingHorizontal: 8,
			paddingVertical: 2,
			borderRadius: radius.pill,
			borderWidth: 1,
			borderColor: colors.border,
			color: colors.muted,
			fontSize: 11,
			fontWeight: '500',
			fontFamily: fontFamily.medium,
			overflow: 'hidden'
		},
		lead: {
			color: colors.muted,
			fontSize: 14,
			lineHeight: 20,
			fontFamily: fontFamily.regular
		},
		progress: { gap: space.sm },
		progressRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
		progressText: {
			color: colors.muted,
			fontSize: 12,
			lineHeight: 16,
			fontFamily: fontFamily.regular
		},
		bar: {
			height: 6,
			borderRadius: radius.pill,
			backgroundColor: colors.bg,
			overflow: 'hidden'
		},
		barFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accentText },
		weeks: { gap: space.lg },
		week: { gap: space.sm },
		weekTitle: {
			color: colors.text,
			fontSize: 17,
			lineHeight: 22,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		session: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.md,
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.md,
			minHeight: 64
		},
		sessionDone: { borderColor: colors.success },
		sessionMain: { flex: 1, gap: 2 },
		sessionTitle: {
			color: colors.text,
			fontSize: 14,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		sessionMeta: {
			color: colors.muted,
			fontSize: 12,
			lineHeight: 16,
			fontFamily: fontFamily.regular
		},
		openPlan: {
			color: colors.accentText,
			fontSize: 12,
			fontWeight: '600',
			fontFamily: fontFamily.semibold,
			marginTop: 2
		},
		done: { flexDirection: 'row', alignItems: 'center', gap: 4 },
		doneText: {
			color: colors.success,
			fontSize: 12,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		how: { gap: space.sm },
		howTitle: {
			color: colors.text,
			fontSize: 15,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		howHint: {
			color: colors.muted,
			fontSize: 13,
			lineHeight: 19,
			fontFamily: fontFamily.regular
		},
		note: {
			color: colors.mutedSoft,
			fontSize: 12,
			lineHeight: 16,
			fontFamily: fontFamily.regular
		}
	});
}
