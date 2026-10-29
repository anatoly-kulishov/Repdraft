import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { labelBodyPart } from '@repdraft/domain/labels.ru';
import type { BodyPartSetShare } from '@repdraft/domain/progressOverview';
import { Panel } from '../components/Panel';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../theme';
import { makeProgressPanelStyles } from './panelStyles';

type Props = {
	shares: BodyPartSetShare[];
	laggingPart: string | null;
};

export function SharesPanel({ shares, laggingPart }: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	if (shares.length === 0) return null;

	return (
		<Panel>
			<Text style={styles.sectionTitle}>{tt('progress.sharesTitle')}</Text>
			{shares.map((part) => {
				const lagging = part.bodyPart === laggingPart;
				return (
					<View key={part.bodyPart} style={styles.part}>
						<View style={styles.partTop}>
							<View style={styles.partLabelRow}>
								<Text style={styles.partLabel} numberOfLines={1}>
									{labelBodyPart(part.bodyPart, locale)}
								</Text>
								{lagging ? (
									<View style={styles.lagTag}>
										<Text style={styles.lagTagText}>{tt('progress.lagging')}</Text>
									</View>
								) : null}
							</View>
							<Text style={styles.rowValue}>{part.sharePct}%</Text>
						</View>
						<View style={styles.barTrack}>
							<View
								style={[
									styles.barFill,
									lagging && styles.barLag,
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
		lagTag: {
			paddingHorizontal: 8,
			paddingVertical: 3,
			borderRadius: radius.tag,
			backgroundColor: colors.dangerBg
		},
		lagTagText: {
			color: colors.danger,
			fontSize: 11,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		}
	});
}
