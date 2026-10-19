import { useRouter } from 'expo-router';
import { Bookmark, Check, Dumbbell, Plus, Target } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
	Image,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	type GestureResponderEvent,
	View
} from 'react-native';
import type { ExerciseIndexItem } from '@repdraft/domain/types';
import {
	labelBodyPart,
	labelEquipment,
	labelTarget
} from '@repdraft/domain/labels.ru';
import { exerciseDisplayName } from '../../src/catalog/loadIndex';
import { catalogMediaUrl } from '../../src/catalog/mediaUrl';
import { useAddToPlan } from '../../src/plan/useAddToPlan';
import { useLocale } from '../../src/state/locale';
import { bookmarksRepo } from '../../src/storage/bookmarksRepo';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../../src/theme';

type Props = {
	exercise: ExerciseIndexItem;
};

export function ExerciseGridCard({ exercise }: Props) {
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const { offerAddToPlan, sheet: addToPlanSheet } = useAddToPlan();
	const [bookmarked, setBookmarked] = useState(false);
	const [inDraft, setInDraft] = useState(false);
	const [justAdded, setJustAdded] = useState(false);
	const [imageFailed, setImageFailed] = useState(false);
	const imageUri = catalogMediaUrl(exercise.image);

	useEffect(() => {
		let mounted = true;
		void bookmarksRepo.has(exercise.id).then((v) => {
			if (mounted) setBookmarked(v);
		});
		return () => {
			mounted = false;
		};
	}, [exercise.id]);

	const title = exerciseDisplayName(exercise.id, locale);
	const targetLabel = exercise.target?.trim()
		? labelTarget(exercise.target, locale)
		: labelBodyPart(exercise.body_part, locale);

	function openDetail() {
		router.push(`/exercise/${exercise.id}`);
	}

	function toggleBookmark(e: GestureResponderEvent) {
		e.stopPropagation();
		void bookmarksRepo.toggle(exercise.id).then((saved) => {
			setBookmarked(saved);
		});
	}

	function addToPlan(e: GestureResponderEvent) {
		e.stopPropagation();
		if (inDraft) {
			setInDraft(false);
			setJustAdded(false);
			return;
		}
		offerAddToPlan(exercise);
		setInDraft(true);
		setJustAdded(true);
		setTimeout(() => setJustAdded(false), 1200);
	}

	return (
		<>
		<Pressable
			style={({ pressed }) => [styles.card, pressed && styles.pressed]}
			onPress={openDetail}
			accessibilityRole="button"
			accessibilityLabel={title}
		>
			<View style={styles.media}>
				{imageUri && !imageFailed ? (
					<Image
						source={{ uri: imageUri }}
						style={styles.image}
						resizeMode="contain"
						onError={() => setImageFailed(true)}
						accessibilityLabel={title}
					/>
				) : (
					<View style={styles.imageFallback}>
						<Dumbbell size={36} color={colors.muted} strokeWidth={1.5} />
					</View>
				)}
				<Pressable
					style={({ pressed }) => [styles.bookmarkBtn, pressed && styles.pressed]}
					onPress={toggleBookmark}
					accessibilityRole="button"
					accessibilityLabel={tt(bookmarked ? 'bookmarks.remove' : 'bookmarks.add')}
					hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}
				>
					<Bookmark
						size={16}
						color="#ffffff"
						strokeWidth={2}
						fill={bookmarked ? '#ffffff' : 'transparent'}
					/>
				</Pressable>
				<Pressable
					style={({ pressed }) => [
						styles.addBtn,
						pressed && styles.pressed,
						inDraft && styles.addBtnActive,
						justAdded && styles.addBtnJustAdded
					]}
					onPress={addToPlan}
					accessibilityRole="button"
					accessibilityLabel={tt(inDraft ? 'exercise.removeDraft' : 'exercise.addDraft')}
					hitSlop={{ top: 6, left: 6, bottom: 6, right: 6 }}
				>
					{inDraft ? (
						<Check size={16} color="#ffffff" strokeWidth={2} />
					) : (
						<Plus size={16} color="#ffffff" strokeWidth={2} />
					)}
				</Pressable>
			</View>
			<View style={styles.body}>
				<Text style={styles.title} numberOfLines={2}>
					{title}
				</Text>
				<View style={styles.metaRow}>
					<View style={styles.metaItem}>
						<Target size={12} color={colors.accentText} strokeWidth={2} />
						<Text style={styles.metaText} numberOfLines={1}>
							{targetLabel}
						</Text>
					</View>
					<View style={styles.metaItem}>
						<Dumbbell size={12} color={colors.accentText} strokeWidth={2} />
						<Text style={styles.metaText} numberOfLines={1}>
							{labelEquipment(exercise.equipment, locale)}
						</Text>
					</View>
				</View>
			</View>
		</Pressable>
		{addToPlanSheet}
		</>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		card: {
			flex: 1,
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			overflow: 'hidden'
		},
		pressed: { opacity: 0.9 },
		media: {
			aspectRatio: 1,
			backgroundColor: colors.panelRaised,
			overflow: 'hidden',
			position: 'relative'
		},
		image: {
			width: '100%',
			height: '100%',
			backgroundColor: colors.panelRaised
		},
		imageFallback: {
			width: '100%',
			height: '100%',
			alignItems: 'center',
			justifyContent: 'center'
		},
		bookmarkBtn: {
			position: 'absolute',
			top: 6,
			left: 6,
			width: 32,
			height: 32,
			borderRadius: 16,
			backgroundColor: 'rgba(15,16,18,0.38)',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 2,
			...Platform.select({
				ios: {
					shadowColor: 'rgba(0,0,0,0.12)',
					shadowOffset: { width: 0, height: 1 },
					shadowOpacity: 1,
					shadowRadius: 2
				},
				android: { elevation: 2 }
			})
		},
		addBtn: {
			position: 'absolute',
			bottom: 5,
			right: 5,
			width: 36,
			height: 36,
			borderRadius: 18,
			backgroundColor: colors.accent,
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 2,
			...Platform.select({
				ios: {
					shadowColor: colors.accent,
					shadowOffset: { width: 0, height: 4 },
					shadowOpacity: 0.38,
					shadowRadius: 14
				},
				android: { elevation: 6 }
			})
		},
		addBtnActive: { backgroundColor: colors.text },
		addBtnJustAdded: { backgroundColor: '#22c55e' },
		body: {
			paddingHorizontal: 12,
			paddingTop: 11,
			paddingBottom: 13,
			gap: 7,
			minHeight: 72
		},
		title: {
			color: colors.text,
			fontSize: 13,
			fontWeight: '600',
			lineHeight: 16,
			minHeight: 32,
			fontFamily: fontFamily.semibold
		},
		metaRow: { flexDirection: 'row', gap: space.sm },
		metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
		metaText: {
			color: colors.muted,
			fontSize: 10,
			lineHeight: 12,
			fontFamily: fontFamily.medium
		}
	});
}
