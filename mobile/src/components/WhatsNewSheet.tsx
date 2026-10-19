import { localizedChangelog } from '@repdraft/domain/changelog';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, space, type ColorPalette } from '../theme';
import { BottomSheet } from './BottomSheet';
import { PrimaryButton } from './PrimaryButton';

type Props = {
	visible: boolean;
	onClose: () => void;
};

export function WhatsNewSheet({ visible, onClose }: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<BottomSheet
			open={visible}
			onDismiss={onClose}
			label={tt('changelog.title')}
			actions={<PrimaryButton label={tt('common.close')} variant="secondary" onPress={onClose} />}
		>
			<Text style={styles.title}>{tt('changelog.title')}</Text>
			<Text style={styles.lead}>{tt('changelog.lead')}</Text>
			<ScrollView style={styles.scroll} contentContainerStyle={{ gap: space.md }}>
				{localizedChangelog(locale, 5).map((release) => (
					<View key={release.version}>
						<Text style={styles.version}>{release.label}</Text>
						{release.highlights.map((line) => (
							<Text key={line} style={styles.bullet}>
								{'• '}
								{line}
							</Text>
						))}
					</View>
				))}
			</ScrollView>
		</BottomSheet>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		title: { fontSize: 20, fontWeight: '800', color: colors.text, fontFamily: fontFamily.extrabold },
		lead: { fontSize: 14, lineHeight: 20, color: colors.muted, fontFamily: fontFamily.regular },
		scroll: { flexGrow: 0 },
		version: { fontWeight: '800', fontSize: 15, marginBottom: 4, color: colors.accent, fontFamily: fontFamily.extrabold },
		bullet: { fontSize: 14, lineHeight: 20, marginBottom: 4, color: colors.muted, fontFamily: fontFamily.regular }
	});
}
