import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Copy } from 'lucide-react-native';
import { formatInviteCode } from '@repdraft/domain/coach';
import { PrimaryButton } from '../components/PrimaryButton';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../theme';

type Props = {
	code: string | null;
	busy: boolean;
	onCreate: () => void;
	onCopy: () => void;
	onRefresh: () => void;
};

/**
 * Invite card: tap code to copy (main pass-to-client action),
 * secondary refresh (confirm sheet for the destructive step).
 */
export function InviteCard({ code, busy, onCreate, onCopy, onRefresh }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const [copied, setCopied] = useState(false);
	const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (copiedTimer.current) clearTimeout(copiedTimer.current);
		},
		[]
	);

	function handleCopy() {
		onCopy();
		setCopied(true);
		if (copiedTimer.current) clearTimeout(copiedTimer.current);
		copiedTimer.current = setTimeout(() => setCopied(false), 1500);
	}

	return (
		<View style={styles.block}>
			<Text style={styles.blockTitle}>{tt('coach.inviteTitle')}</Text>
			<View style={styles.card}>
				<Text style={styles.cardHint}>{tt('coach.inviteHint')}</Text>
				{code ? (
					<>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={tt('coach.inviteCopy')}
							style={({ pressed }) => [styles.codePlate, pressed && styles.pressed]}
							onPress={handleCopy}
						>
							<Text style={styles.codeText} numberOfLines={1}>
								{formatInviteCode(code)}
							</Text>
							{copied ? (
								<Check color={colors.success} size={20} strokeWidth={2.5} />
							) : (
								<Copy color={colors.accentText} size={20} strokeWidth={2} />
							)}
						</Pressable>
						<Text style={styles.help}>{tt('coach.inviteHelp')}</Text>
						<PrimaryButton
							label={tt('coach.inviteRefresh')}
							variant="secondary"
							disabled={busy}
							onPress={onRefresh}
						/>
					</>
				) : (
					<PrimaryButton
						label={tt('coach.inviteCreateShort')}
						onPress={onCreate}
						disabled={busy}
					/>
				)}
			</View>
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		block: { gap: space.md },
		blockTitle: {
			color: colors.text,
			fontSize: 18,
			lineHeight: 24,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		card: {
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			padding: space.lg,
			gap: space.md
		},
		cardHint: {
			color: colors.muted,
			fontSize: 13,
			lineHeight: 18,
			fontFamily: fontFamily.regular
		},
		help: {
			color: colors.muted,
			fontSize: 12,
			lineHeight: 17,
			fontFamily: fontFamily.regular
		},
		codePlate: {
			minHeight: 56,
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			paddingLeft: space.lg,
			paddingRight: space.md,
			borderRadius: radius.control,
			backgroundColor: colors.bg
		},
		codeText: {
			flex: 1,
			color: colors.text,
			fontSize: 22,
			lineHeight: 28,
			fontWeight: '700',
			letterSpacing: 2,
			fontVariant: ['tabular-nums'],
			fontFamily: fontFamily.bold
		},
		pressed: { opacity: 0.85 }
	});
}
