import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ClipboardList } from 'lucide-react-native';
import type { CoachAssignment } from '@repdraft/domain/coach';
import { PrimaryButton } from '../components/PrimaryButton';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../theme';

type Props = {
	assignment: CoachAssignment;
	busy: boolean;
	onImport: () => void;
	onHide: () => void;
};

/** Home banner: coach assigned a plan — import it or hide for now. */
export function HomeAssignmentCard({ assignment, busy, onImport, onHide }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<View style={styles.card}>
			<View style={styles.head}>
				<View style={styles.icon}>
					<ClipboardList color={colors.accentText} size={20} strokeWidth={2} />
				</View>
				<View style={styles.text}>
					<Text style={styles.kicker}>{tt('coach.assignedTitle')}</Text>
					<Text style={styles.title} numberOfLines={2}>
						{assignment.planName}
					</Text>
					{assignment.coachName ? (
						<Text style={styles.meta}>{assignment.coachName}</Text>
					) : null}
				</View>
			</View>
			<View style={styles.actions}>
				<PrimaryButton
					label={tt('coach.assignedAdd')}
					onPress={onImport}
					disabled={busy}
				/>
				<PrimaryButton
					label={tt('coach.assignedHide')}
					variant="ghost"
					compact
					onPress={onHide}
					disabled={busy}
				/>
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		card: {
			padding: space.md,
			gap: space.md,
			borderWidth: 1,
			borderColor: colors.accentDim,
			borderRadius: radius.md,
			backgroundColor: colors.accentDim
		},
		head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
		icon: {
			width: 36,
			height: 36,
			alignItems: 'center',
			justifyContent: 'center',
			borderRadius: radius.control,
			backgroundColor: colors.panel
		},
		text: { flex: 1, minWidth: 0 },
		kicker: {
			color: colors.secondary,
			fontSize: 12,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		title: {
			marginTop: 2,
			color: colors.text,
			fontSize: 16,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		meta: { marginTop: 2, color: colors.muted, fontSize: 13 },
		actions: { gap: space.sm }
	});
}
