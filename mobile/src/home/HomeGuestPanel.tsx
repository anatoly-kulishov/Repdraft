import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NotebookPen, Smartphone, UserRound } from 'lucide-react-native';
import { Panel } from '../components/Panel';
import { PrimaryButton } from '../components/PrimaryButton';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	onCreate: () => void;
	onSignIn: () => void;
};

/** Guest cold start: train locally, sign in later. */
export function HomeGuestPanel({ onCreate, onSignIn }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const points = [
		{ icon: NotebookPen, text: tt('home.guestPointLog') },
		{ icon: Smartphone, text: tt('home.guestPointLocal') },
		{ icon: UserRound, text: tt('home.guestPointSync') }
	];

	return (
		<Panel>
			<Text style={styles.kicker}>{tt('home.guestTrainKicker')}</Text>
			<Text style={styles.title}>{tt('home.guestTrainTitle')}</Text>
			<Text style={styles.meta}>{tt('home.guestTrainLead')}</Text>
			{points.map(({ icon: Icon, text }) => (
				<View key={text} style={styles.point}>
					<Icon color={colors.muted} size={18} strokeWidth={2.25} />
					<Text style={styles.pointText}>{text}</Text>
				</View>
			))}
			<PrimaryButton label={tt('home.guestCreateLocal')} onPress={onCreate} />
			<PrimaryButton label={tt('nav.signIn')} variant="secondary" onPress={onSignIn} />
		</Panel>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		kicker: {
			fontSize: 12,
			lineHeight: 16,
			fontWeight: '400',
			fontFamily: fontFamily.regular,
			color: colors.mutedSoft
		},
		title: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '700', fontFamily: fontFamily.bold },
		meta: { color: colors.muted, fontFamily: fontFamily.regular, lineHeight: 20 },
		point: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			minHeight: touchMin
		},
		pointText: { color: colors.muted, fontFamily: fontFamily.regular, flex: 1 }
	});
}
