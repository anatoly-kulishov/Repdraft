import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppColors } from '../state/theme';
import { radius, space, type ColorPalette } from '../theme';

type PageSkeletonVariant = 'home' | 'planPreview' | 'summary';

export function PageSkeleton({ variant }: { variant: PageSkeletonVariant }) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<View style={styles.root}>
			{variant === 'home' ? (
				<>
					<View style={styles.headerRow}>
						<View style={[styles.bone, styles.brandMark]} />
						<View style={styles.headerCopy}>
							<View style={[styles.bone, styles.greeting]} />
							<View style={[styles.bone, styles.leadHint]} />
						</View>
					</View>
					<View style={[styles.bone, styles.heroCard]}>
						<View style={[styles.bone, styles.eyebrow]} />
						<View style={[styles.bone, styles.cardTitle]} />
						<View style={[styles.bone, styles.cardMeta]} />
						<View style={[styles.bone, styles.cta]} />
					</View>
					<View style={[styles.bone, styles.sectionTitle]} />
					<View style={styles.rowStack}>
						<View style={[styles.bone, styles.planRow]} />
						<View style={[styles.bone, styles.planRow]} />
						<View style={[styles.bone, styles.planRow]} />
					</View>
				</>
			) : null}

			{variant === 'planPreview' ? (
				<>
					<View style={[styles.bone, styles.previewTitle]} />
					<View style={[styles.bone, styles.previewMeta]} />
					<View style={[styles.bone, styles.previewMetaShort]} />
					<View style={styles.rowStack}>
						<View style={[styles.bone, styles.exerciseCard]}>
							<View style={[styles.bone, styles.exerciseTitle]} />
							<View style={[styles.bone, styles.exerciseMeta]} />
						</View>
						<View style={[styles.bone, styles.exerciseCard]}>
							<View style={[styles.bone, styles.exerciseTitle]} />
							<View style={[styles.bone, styles.exerciseMeta]} />
						</View>
						<View style={[styles.bone, styles.exerciseCard]}>
							<View style={[styles.bone, styles.exerciseTitle]} />
							<View style={[styles.bone, styles.exerciseMeta]} />
						</View>
						<View style={[styles.bone, styles.exerciseCard]}>
							<View style={[styles.bone, styles.exerciseTitle]} />
							<View style={[styles.bone, styles.exerciseMeta]} />
						</View>
					</View>
					<View style={[styles.bone, styles.footerCta]} />
					<View style={[styles.bone, styles.footerLink]} />
				</>
			) : null}

			{variant === 'summary' ? (
				<>
					<View style={[styles.bone, styles.kicker]} />
					<View style={[styles.bone, styles.summaryTitle]} />
					<View style={styles.statsRow}>
						<View style={[styles.bone, styles.statBlock]} />
						<View style={[styles.bone, styles.statBlock]} />
					</View>
					<View style={styles.rowStack}>
						<View style={[styles.bone, styles.summaryCard]}>
							<View style={[styles.bone, styles.exerciseTitle]} />
							<View style={[styles.bone, styles.exerciseMeta]} />
						</View>
						<View style={[styles.bone, styles.summaryCard]}>
							<View style={[styles.bone, styles.exerciseTitle]} />
							<View style={[styles.bone, styles.exerciseMeta]} />
						</View>
					</View>
					<View style={[styles.bone, styles.footerCta]} />
				</>
			) : null}
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: {
			flex: 1,
			backgroundColor: colors.bg,
			padding: space.lg,
			gap: space.md
		},
		bone: {
			backgroundColor: colors.panel,
			borderRadius: radius.sm
		},
		headerRow: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.md,
			paddingBottom: space.xs
		},
		brandMark: {
			width: 40,
			height: 40,
			borderRadius: radius.md
		},
		headerCopy: {
			flex: 1,
			gap: space.xs
		},
		greeting: {
			height: 24,
			width: '70%'
		},
		leadHint: {
			height: 14,
			width: '50%',
			backgroundColor: colors.panelRaised
		},
		heroCard: {
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.lg,
			gap: space.sm
		},
		eyebrow: {
			height: 12,
			width: '40%',
			backgroundColor: colors.panelRaised
		},
		cardTitle: {
			height: 22,
			width: '80%'
		},
		cardMeta: {
			height: 14,
			width: '55%',
			backgroundColor: colors.panelRaised
		},
		cta: {
			height: 44,
			borderRadius: radius.md,
			marginTop: space.xs
		},
		sectionTitle: {
			height: 12,
			width: '35%',
			marginTop: space.sm,
			backgroundColor: colors.panelRaised
		},
		rowStack: {
			gap: space.sm
		},
		planRow: {
			height: 64,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border
		},
		previewTitle: {
			height: 30,
			width: '85%',
			borderRadius: radius.sm
		},
		previewMeta: {
			height: 14,
			width: '55%',
			backgroundColor: colors.panelRaised
		},
		previewMetaShort: {
			height: 14,
			width: '35%',
			backgroundColor: colors.panelRaised
		},
		exerciseCard: {
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.lg,
			gap: space.xs
		},
		exerciseTitle: {
			height: 18,
			width: '75%'
		},
		exerciseMeta: {
			height: 13,
			width: '45%',
			backgroundColor: colors.panelRaised
		},
		footerCta: {
			height: 48,
			borderRadius: radius.md,
			marginTop: space.sm
		},
		footerLink: {
			height: 20,
			width: '40%',
			alignSelf: 'center',
			backgroundColor: colors.panelRaised
		},
		kicker: {
			height: 14,
			width: '35%',
			backgroundColor: colors.panelRaised
		},
		summaryTitle: {
			height: 30,
			width: '80%'
		},
		statsRow: {
			flexDirection: 'row',
			gap: space.sm
		},
		statBlock: {
			flex: 1,
			height: 76,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border
		},
		summaryCard: {
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.lg,
			gap: space.xs
		}
	});
}
