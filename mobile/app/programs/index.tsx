import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bookmark, ChevronRight } from 'lucide-react-native';
import { labelEquipment } from '@repdraft/domain/labels.ru';
import {
	programLead,
	programSessionMinutes,
	programTitle
} from '@repdraft/domain/programs';
import { EmptyState } from '../../src/components/EmptyState';
import { PageSkeleton } from '../../src/components/PageSkeleton';
import { useBottomChromePad } from '../../src/layout/safe';
import { useProgramsHub } from '../../src/program/usePrograms';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../../src/theme';

export default function ProgramsHubScreen() {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);
	const hub = useProgramsHub();

	if (hub.loading) {
		return <PageSkeleton variant="home" />;
	}

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}
		>
			<Text style={styles.lead}>{tt('programs.lead')}</Text>

			{hub.items.length === 0 ? (
				<EmptyState title={tt('programs.title')} description={tt('programs.hubNote')} />
			) : (
				hub.items.map(({ program, progress }) => {
					const saved = hub.savedSlugs.includes(program.slug);
					const minutes = programSessionMinutes(program);
					const time =
						minutes.min === minutes.max
							? tt('programs.sessionMinutes', { n: minutes.min })
							: tt('programs.sessionMinutesRange', { min: minutes.min, max: minutes.max });
					return (
						<Pressable
							key={program.slug}
							accessibilityRole="button"
							accessibilityLabel={programTitle(program, locale)}
							onPress={() => router.push(`/programs/${program.slug}`)}
							style={({ pressed }) => [styles.card, pressed && styles.pressed]}
						>
							<View style={styles.cardTop}>
								<View style={styles.tags}>
									<Text style={styles.tag}>
										{tt(
											program.level === 'novice'
												? 'programs.levelNovice'
												: 'programs.levelIntermediate'
										)}
									</Text>
									<Text style={styles.tag}>
										{tt('programs.weeks', { n: program.weeks })}
									</Text>
								</View>
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={tt(saved ? 'programs.unsave' : 'programs.save')}
									accessibilityState={{ selected: saved }}
									hitSlop={10}
									onPress={() => void hub.toggleSaved(program.slug)}
									style={styles.save}
								>
									<Bookmark
										size={20}
										color={saved ? colors.accentText : colors.muted}
										fill={saved ? colors.accentText : 'transparent'}
									/>
								</Pressable>
							</View>

							<Text style={styles.title}>{programTitle(program, locale)}</Text>
							<Text style={styles.body}>{programLead(program, locale)}</Text>
							<Text style={styles.meta}>
								{tt('programs.sessionsPerWeek', {
									n: program.sessions.length
								})}{' '}
								· {time}
							</Text>
							<View
								style={styles.kit}
								accessibilityLabel={tt('programs.equipmentTitle')}
							>
								{program.equipment.map((kit) => (
									<Text key={kit} style={styles.kitItem}>
										{labelEquipment(kit, locale)}
									</Text>
								))}
							</View>

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
								accessibilityValue={{
									min: 0,
									max: progress.total,
									now: progress.done
								}}
							>
								<View
									style={[styles.barFill, { width: `${progress.percent}%` }]}
								/>
							</View>

							<View style={styles.openRow}>
								<Text style={styles.openText}>{tt('programs.open')}</Text>
								<ChevronRight color={colors.accentText} size={16} strokeWidth={2.4} />
							</View>
						</Pressable>
					);
				})
			)}

			<Text style={styles.note}>{tt('programs.localHint')}</Text>
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		scroll: { flex: 1, backgroundColor: colors.bg },
		root: { padding: space.lg, gap: space.md },
		lead: {
			color: colors.muted,
			fontSize: 14,
			lineHeight: 20,
			fontFamily: fontFamily.regular
		},
		card: {
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.lg,
			gap: space.sm
		},
		pressed: { opacity: 0.92 },
		cardTop: {
			flexDirection: 'row',
			alignItems: 'flex-start',
			justifyContent: 'space-between',
			gap: space.sm
		},
		tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
		tag: {
			paddingHorizontal: 8,
			paddingVertical: 2,
			borderRadius: radius.pill,
			backgroundColor: colors.bg,
			color: colors.muted,
			fontSize: 11,
			fontWeight: '600',
			fontFamily: fontFamily.semibold,
			overflow: 'hidden'
		},
		save: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
		title: {
			color: colors.text,
			fontSize: 17,
			lineHeight: 22,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		body: {
			color: colors.muted,
			fontSize: 13,
			lineHeight: 19,
			fontFamily: fontFamily.regular
		},
		meta: {
			color: colors.mutedSoft,
			fontSize: 12,
			lineHeight: 16,
			fontFamily: fontFamily.regular
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
		progressRow: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			gap: space.sm,
			marginTop: space.xs
		},
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
		openRow: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 4,
			marginTop: space.xs
		},
		openText: {
			color: colors.accentText,
			fontSize: 13,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		note: {
			color: colors.mutedSoft,
			fontSize: 12,
			lineHeight: 16,
			textAlign: 'center',
			fontFamily: fontFamily.regular
		}
	});
}
