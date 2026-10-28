import { Image as ImageIcon, Trash } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../theme';
import { BottomSheet } from './BottomSheet';
import { PrimaryButton } from './PrimaryButton';

type Props = {
	open: boolean;
	canRemove: boolean;
	busy?: boolean;
	onChangePhoto: () => void;
	onRemovePhoto: () => void;
	onDismiss: () => void;
};

/** Profile photo actions as scannable rows (web ProfileAvatarSheet twin). */
export function ProfileAvatarSheet({
	open,
	canRemove,
	busy = false,
	onChangePhoto,
	onRemovePhoto,
	onDismiss
}: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	function run(action: () => void) {
		if (busy) return;
		onDismiss();
		action();
	}

	return (
		<BottomSheet
			open={open}
			onDismiss={onDismiss}
			label={tt('auth.avatar.sheetTitle')}
			actions={
				<PrimaryButton label={tt('common.cancel')} variant="ghost" onPress={onDismiss} />
			}
		>
			<Text style={styles.title}>{tt('auth.avatar.sheetTitle')}</Text>
			<View>
				<Pressable
					accessibilityRole="button"
					disabled={busy}
					style={styles.row}
					onPress={() => run(onChangePhoto)}
				>
					<View style={[styles.plate, { backgroundColor: colors.accentDim }]}>
						<ImageIcon size={20} color={colors.accent} strokeWidth={2} />
					</View>
					<Text style={styles.label}>{tt('auth.avatar.change')}</Text>
				</Pressable>
				{canRemove ? (
					<Pressable
						accessibilityRole="button"
						disabled={busy}
						style={[styles.row, styles.rowDivider]}
						onPress={() => run(onRemovePhoto)}
					>
						<View style={[styles.plate, { backgroundColor: colors.dangerBg }]}>
							<Trash size={20} color={colors.danger} strokeWidth={2} />
						</View>
						<Text style={[styles.label, styles.labelDanger]}>
							{tt('auth.avatar.remove')}
						</Text>
					</Pressable>
				) : null}
			</View>
		</BottomSheet>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		title: {
			color: colors.text,
			fontSize: 17,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		row: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.md,
			minHeight: 56,
			paddingVertical: space.sm
		},
		rowDivider: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.border
		},
		plate: {
			width: 44,
			height: 44,
			borderRadius: radius.sm,
			alignItems: 'center',
			justifyContent: 'center'
		},
		label: {
			color: colors.text,
			fontSize: 15,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		labelDanger: { color: colors.danger }
	});
}
