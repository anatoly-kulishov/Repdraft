import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, type ColorPalette } from '../theme';
import { BottomSheet } from './BottomSheet';
import { PrimaryButton } from './PrimaryButton';

export type ConfirmAction = {
	label: string;
	onPress: () => void;
	variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
};

type Props = {
	open: boolean;
	title: string;
	message?: string;
	onDismiss: () => void;
	actions: ConfirmAction[];
	/** Hide the extra Cancel when an action already dismisses (finish offer: Later). */
	showCancel?: boolean;
};

/** Sacred-loop confirms (finish / skip / discard) - twin of web BottomSheet dialogs. */
export function ConfirmSheet({ open, title, message, onDismiss, actions, showCancel = true }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<BottomSheet
			open={open}
			onDismiss={onDismiss}
			label={title}
			actions={
				<>
					{actions.map((a) => (
						<PrimaryButton
							key={a.label}
							label={a.label}
							variant={a.variant ?? 'primary'}
							onPress={() => {
								a.onPress();
								onDismiss();
							}}
						/>
					))}
					{showCancel ? (
						<PrimaryButton label={tt('common.cancel')} variant="ghost" onPress={onDismiss} />
					) : null}
				</>
			}
		>
			<Text style={styles.title}>{title}</Text>
			{message ? <Text style={styles.message}>{message}</Text> : null}
		</BottomSheet>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		title: { color: colors.text, fontSize: 20, fontWeight: '800', fontFamily: fontFamily.extrabold },
		message: { color: colors.muted, fontSize: 15, lineHeight: 22, fontFamily: fontFamily.regular }
	});
}
