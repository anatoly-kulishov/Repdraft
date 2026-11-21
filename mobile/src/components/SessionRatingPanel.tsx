import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { SESSION_RATING_VALUES, type SessionRating } from '@repdraft/domain/sessionRating';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { sessionRatingsRepo } from '../storage/sessionRatingsRepo';
import { space, touchMin, type ColorPalette } from '../theme';
import { Panel } from './Panel';

/**
 * One question after real work. Ratings stay on the device for now, the same
 * local-only contract as the web panel and the program runs.
 */
export function SessionRatingPanel({
	sessionId,
	variant = 'summary'
}: {
	sessionId: string;
	variant?: 'summary' | 'detail';
}) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const [mine, setMine] = useState<SessionRating | null>(null);

	useEffect(() => {
		let cancelled = false;
		void sessionRatingsRepo.get(sessionId).then((stars) => {
			if (!cancelled) setMine(stars);
		});
		return () => {
			cancelled = true;
		};
	}, [sessionId]);

	async function rate(stars: SessionRating) {
		setMine(stars);
		await sessionRatingsRepo.set(sessionId, stars);
	}

	return (
		<Panel>
			<Text style={styles.title}>
				{tt(mine ? (variant === 'detail' ? 'rating.yours' : 'rating.thanks') : 'rating.title')}
			</Text>
			<View
				style={styles.stars}
				accessibilityRole="radiogroup"
				accessibilityLabel={tt('rating.aria')}
			>
				{SESSION_RATING_VALUES.map((value) => {
					const active = mine !== null && value <= mine;
					return (
						<Pressable
							key={value}
							onPress={() => void rate(value)}
							accessibilityRole="button"
							accessibilityState={{ selected: mine === value }}
							accessibilityLabel={tt('rating.ariaStar', { n: value })}
							style={styles.star}
						>
							<Star
								size={26}
								color={active ? colors.accentText : colors.mutedSoft}
								fill={active ? colors.accentText : 'none'}
							/>
						</Pressable>
					);
				})}
			</View>
			<Text style={styles.hint}>{tt('rating.hint')}</Text>
		</Panel>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		title: {
			color: colors.text,
			fontSize: 15,
			fontWeight: '600',
			textAlign: 'center'
		},
		/* Centred like the web card: the avatar and plan name above are centred too. */
		stars: {
			alignSelf: 'stretch',
			flexDirection: 'row',
			justifyContent: 'center',
			gap: space.xs,
			marginTop: space.xs
		},
		star: {
			width: touchMin,
			height: touchMin,
			alignItems: 'center',
			justifyContent: 'center'
		},
		hint: {
			color: colors.muted,
			fontSize: 12,
			lineHeight: 17,
			textAlign: 'center'
		}
	});
}
