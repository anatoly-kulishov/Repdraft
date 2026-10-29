import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { OnboardingChecklistPanel } from '../../src/components/OnboardingChecklistPanel';
import { PageSkeleton } from '../../src/components/PageSkeleton';
import { Panel } from '../../src/components/Panel';
import { HomeGuestPanel } from '../../src/home/HomeGuestPanel';
import { HomeHeader } from '../../src/home/HomeHeader';
import { HomeAssignmentCard } from '../../src/home/HomeAssignmentCard';
import { HomeProgressCards } from '../../src/home/HomeProgressCards';
import { PlanHeroCard } from '../../src/home/PlanHeroCard';
import { RecentSessionsCard } from '../../src/home/RecentSessionsCard';
import { useHomeDashboard } from '../../src/home/useHomeDashboard';
import { useTabScreenPad } from '../../src/layout/safe';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, space, type ColorPalette } from '../../src/theme';

export default function WorkoutsScreen() {
	const router = useRouter();
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const tabPad = useTabScreenPad(space.lg);
	const home = useHomeDashboard();

	if (home.loading) {
		return <PageSkeleton variant="home" />;
	}

	return (
		<ScrollView
			style={styles.flexList}
			contentContainerStyle={[styles.list, { paddingBottom: tabPad }]}
		>
			<View style={styles.wrap}>
				<HomeHeader avatarUrl={home.avatarUrl} greeting={home.greeting} />

				{home.assignment ? (
					<HomeAssignmentCard
						assignment={home.assignment}
						busy={home.assignmentBusy}
						onImport={() => void home.importAssignment()}
						onHide={home.hideAssignment}
					/>
				) : null}

				{home.pendingSync > 0 ? (
					<Panel style={styles.syncBanner}>
						<Text style={styles.syncBannerText}>
							{tt('profile.outbox', { n: home.pendingSync })}
						</Text>
					</Panel>
				) : null}

				<PlanHeroCard
					active={home.active}
					continueMeta={home.continueMeta}
					next={home.next}
					heroMeta={home.heroMeta}
					onContinue={(planId) => router.push(`/live/${planId}`)}
					onOpenPlan={(planId) => router.push(`/plan/${planId}`)}
				/>

				{home.showChecklist && home.onboarding ? (
					<OnboardingChecklistPanel
						state={home.onboarding}
						onDismiss={() => void home.dismissOnboarding()}
						onTryDemo={home.tryDemo}
					/>
				) : null}

				{home.showGuestHero ? (
					<HomeGuestPanel
						onCreate={() => void home.createBlank()}
						onSignIn={() => router.push('/(tabs)/profile')}
					/>
				) : null}

				{home.monthly && home.monthly.workouts > 0 ? (
					<HomeProgressCards
						monthly={home.monthly}
						onOpen={() => router.push('/progress')}
					/>
				) : null}

				<RecentSessionsCard
					recent={home.recent}
					hasPlans={home.hasPlans}
					showGuestHero={home.showGuestHero}
					onOpenSession={(id) => router.push(`/history/${id}`)}
					onOpenHistory={() => router.push('/history')}
				/>
			</View>
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		flexList: { flex: 1 },
		list: { flexGrow: 1, padding: space.lg },
		wrap: { gap: 24, paddingBottom: space.sm },
		syncBanner: {
			backgroundColor: colors.accentDim,
			borderColor: colors.accent
		},
		syncBannerText: {
			color: colors.accentLink,
			fontWeight: '600',
			fontSize: 14,
			fontFamily: fontFamily.semibold
		}
	});
}
