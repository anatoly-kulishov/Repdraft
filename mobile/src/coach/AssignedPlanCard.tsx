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
	onDismiss: () => void;
};

/** Client-side card: coach assigned a plan → import it or dismiss. */
export function AssignedPlanCard({ assignment, busy, onImport, onDismiss }: Props) {
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
					<Text style={styles.title}>{tt('coach.assignedTitle')}</Text>
					<Text style={styles.body} numberOfLines={2}>
						{assignment.planName}
						{assignment.coachName ? ` · ${assignment.coachName}` : ''}
					</Text>
				</View>
			</View>
			<PrimaryButton
				label={tt('coach.assignedAdd')}
				onPress={onImport}
				disabled={busy}
			/>
			<PrimaryButton
				label={tt('coach.assignedDismiss')}
				variant="ghost"
				compact
				onPress={onDismiss}
				disabled={busy}
			/>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		card: {
			marginTop: space.md,
			padding: space.md,
			gap: space.sm,
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
		title: {
			color: colors.text,
			fontSize: 15,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		body: { marginTop: 2, color: colors.secondary, fontSize: 13, lineHeight: 18 }
	});
}
