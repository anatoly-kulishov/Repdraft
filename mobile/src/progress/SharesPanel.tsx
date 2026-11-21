import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { labelCatalogZone } from '@repdraft/domain/catalogLinks';
import type { BodyPartSetShare } from '@repdraft/domain/progressOverview';
import { Panel } from '../components/Panel';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../theme';
import { makeProgressPanelStyles } from './panelStyles';

type Props = {
	shares: BodyPartSetShare[];
	smallestPart: string | null;
};

export function SharesPanel({ shares, smallestPart }: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	if (shares.length === 0) return null;

	return (
		<Panel>
			<Text style={styles.sectionTitle}>{tt('progress.sharesTitle')}</Text>
			{shares.map((part) => {
				const smallest = part.bodyPart === smallestPart;
				return (
					<View key={part.bodyPart} style={styles.part}>
						<View style={styles.partTop}>
							<View style={styles.partLabelRow}>
								<Text style={styles.partLabel} numberOfLines={1}>
									{labelCatalogZone(part.bodyPart, locale)}
								</Text>
								{smallest ? (
									<View style={styles.smallestTag}>
										<Text style={styles.smallestTagText}>{tt('progress.smallestShare')}</Text>
									</View>
								) : null}
							</View>
							<Text style={styles.rowValue}>{part.sharePct}%</Text>
						</View>
						<View style={styles.barTrack}>
							<View
								style={[
									styles.barFill,
									{ width: `${part.sharePct}%` }
								]}
							/>
						</View>
					</View>
				);
			})}
		</Panel>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		...makeProgressPanelStyles(colors),
		part: { gap: 6, paddingVertical: 6 },
		partTop: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			gap: space.sm,
			alignItems: 'center'
		},
		partLabelRow: {
			flex: 1,
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			minWidth: 0
		},
		partLabel: {
			flexShrink: 1,
			color: colors.text,
			fontSize: 13,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		smallestTag: {
			paddingHorizontal: 8,
			paddingVertical: 3,
			borderRadius: radius.tag,
			backgroundColor: colors.border
		},
		smallestTagText: {
			color: colors.muted,
			fontSize: 11,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		}
	});
}
