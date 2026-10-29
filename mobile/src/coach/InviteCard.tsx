import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Copy, MoreVertical, Share2 } from 'lucide-react-native';
import { formatInviteCode } from '@repdraft/domain/coach';
import { PrimaryButton } from '../components/PrimaryButton';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	code: string | null;
	busy: boolean;
	onCreate: () => void;
	onCopy: () => void;
	onShare: () => void;
	onMenu: () => void;
};

/** Compact invite card: code plate with copy, share, and a ⋮ menu. */
export function InviteCard({ code, busy, onCreate, onCopy, onShare, onMenu }: Props) {
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
				<View style={styles.cardTopRow}>
					<Text style={styles.cardHint}>{tt('coach.inviteHint')}</Text>
					{code ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={tt('coach.more')}
							hitSlop={4}
							style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}
							onPress={onMenu}
						>
							<MoreVertical color={colors.muted} size={20} strokeWidth={2} />
						</Pressable>
					) : null}
				</View>
				{code ? (
					<>
						<View style={styles.codeRow}>
							<View style={styles.codePlate}>
								<Text style={styles.codeText} numberOfLines={1}>
									{formatInviteCode(code)}
								</Text>
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={tt('coach.inviteCopy')}
									hitSlop={4}
									style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
									onPress={handleCopy}
								>
									{copied ? (
										<Check color={colors.success} size={20} strokeWidth={2.5} />
									) : (
										<Copy color={colors.accentText} size={20} strokeWidth={2} />
									)}
								</Pressable>
							</View>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={tt('coach.inviteShare')}
								style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
								onPress={onShare}
							>
								<Share2 color={colors.accentText} size={20} strokeWidth={2} />
							</Pressable>
						</View>
						<Text style={styles.help}>{tt('coach.inviteHelp')}</Text>
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
		cardTopRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: space.sm
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
		moreBtn: {
			width: 44,
			height: 44,
			alignItems: 'center',
			justifyContent: 'center'
		},
		codeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
		codePlate: {
			flex: 1,
			minHeight: 56,
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.sm,
			paddingLeft: space.lg,
			paddingRight: space.sm,
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
		copyBtn: {
			width: touchMin,
			height: touchMin,
			alignItems: 'center',
			justifyContent: 'center'
		},
		shareBtn: {
			width: 52,
			height: 52,
			borderRadius: radius.control,
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: colors.panelRaised
		},
		pressed: { opacity: 0.85 }
	});
}
