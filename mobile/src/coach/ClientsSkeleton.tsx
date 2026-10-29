import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppColors } from '../state/theme';
import { radius, space, type ColorPalette } from '../theme';

/** Three shimmer-less placeholder rows for the first cloud load. */
export function ClientsSkeleton() {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	return (
		<View style={styles.card} accessibilityLabel="Loading" accessibilityRole="progressbar">
			{[0, 1, 2].map((row) => (
				<View key={row} style={styles.row}>
					<View style={styles.avatar} />
					<View style={styles.copy}>
						<View style={styles.name} />
						<View style={styles.meta} />
					</View>
					<View style={styles.chip} />
				</View>
			))}
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		card: {
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			padding: space.lg,
			gap: space.lg
		},
		row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
		avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.panelRaised },
		copy: { flex: 1, gap: 6 },
		name: { height: 16, width: '45%', borderRadius: 6, backgroundColor: colors.panelRaised },
		meta: { height: 12, width: '65%', borderRadius: 6, backgroundColor: colors.panelRaised },
		chip: { width: 64, height: 44, borderRadius: 12, backgroundColor: colors.panelRaised }
	});
}
