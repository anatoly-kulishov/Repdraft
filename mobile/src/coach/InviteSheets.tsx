import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { PrimaryButton } from '../components/PrimaryButton';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, type ColorPalette } from '../theme';

type Props = {
	helpOpen: boolean;
	onCloseHelp: () => void;
	menuOpen: boolean;
	onCloseMenu: () => void;
	hasCode: boolean;
	busy: boolean;
	onCopy: () => void;
	onRefresh: () => void;
	refreshConfirmOpen: boolean;
	onCloseRefreshConfirm: () => void;
	onConfirmRefresh: () => void;
};

/** Help, ⋮ menu and destructive "refresh code" confirm for the invite card. */
export function InviteSheets({
	helpOpen,
	onCloseHelp,
	menuOpen,
	onCloseMenu,
	hasCode,
	busy,
	onCopy,
	onRefresh,
	refreshConfirmOpen,
	onCloseRefreshConfirm,
	onConfirmRefresh
}: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	return (
		<>
			<BottomSheet open={helpOpen} onDismiss={onCloseHelp} label={tt('coach.helpTitle')}>
				<Text style={styles.title}>{tt('coach.helpTitle')}</Text>
				<Text style={styles.muted}>{tt('coach.helpBody')}</Text>
				<PrimaryButton
					label={tt('common.close')}
					variant="secondary"
					onPress={onCloseHelp}
				/>
			</BottomSheet>

			<BottomSheet open={menuOpen} onDismiss={onCloseMenu} label={tt('coach.inviteTitle')}>
				<Text style={styles.title}>{tt('coach.inviteTitle')}</Text>
				{hasCode ? (
					<PrimaryButton
						label={tt('coach.inviteCopy')}
						variant="secondary"
						onPress={() => {
							onCloseMenu();
							onCopy();
						}}
					/>
				) : null}
				<PrimaryButton
					label={tt('coach.inviteRefresh')}
					variant="danger"
					disabled={busy}
					onPress={() => {
						onCloseMenu();
						onRefresh();
					}}
				/>
			</BottomSheet>

			<ConfirmSheet
				open={refreshConfirmOpen}
				title={tt('coach.inviteRefreshConfirmTitle')}
				message={tt('coach.inviteRefreshConfirmLead')}
				onDismiss={onCloseRefreshConfirm}
				actions={[
					{
						label: tt('coach.inviteRefresh'),
						variant: 'danger',
						onPress: onConfirmRefresh
					}
				]}
			/>
		</>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		title: {
			color: colors.text,
			fontSize: 20,
			fontWeight: '800',
			fontFamily: fontFamily.extrabold
		},
		muted: {
			color: colors.muted,
			fontSize: 14,
			fontFamily: fontFamily.regular,
			lineHeight: 20
		}
	});
}
