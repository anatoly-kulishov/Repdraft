import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
	fetchExerciseDetail,
	stepsForLocale,
	type ExerciseDetailPayload
} from '../catalog/fetchExerciseDetail';
import { useBottomChromePad } from '../layout/safe';
import { useLocale } from '../state/locale';
import { colors, radius, space, touchMin } from '../theme';
import { CatalogThumb } from './CatalogThumb';
import { PrimaryButton } from './PrimaryButton';

type Props = {
	exerciseId: string | null;
	onClose: () => void;
};

export function TechniqueSheet({ exerciseId, onClose }: Props) {
	const { locale, tt } = useLocale();
	const bottomPad = useBottomChromePad(space.md);
	const [detail, setDetail] = useState<ExerciseDetailPayload | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!exerciseId) {
			setDetail(null);
			return;
		}
		let cancelled = false;
		setLoading(true);
		void fetchExerciseDetail(exerciseId).then((row) => {
			if (!cancelled) {
				setDetail(row);
				setLoading(false);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [exerciseId]);

	const open = Boolean(exerciseId);
	const steps = stepsForLocale(detail, locale);
	const title =
		locale === 'ru' && detail?.name_ru?.trim()
			? detail.name_ru.trim()
			: detail?.name ?? tt('exercise.detail');

	return (
		<Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
			<View style={styles.wrap}>
				<Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
				<View style={[styles.sheet, { paddingBottom: bottomPad }]}>
					<View style={styles.handle} />
					<Text style={styles.title} numberOfLines={2}>
						{title}
					</Text>
					{detail ? (
						<Text style={styles.meta} numberOfLines={1}>
							{detail.body_part} · {detail.equipment}
						</Text>
					) : null}
					<ScrollView
						style={styles.scroll}
						contentContainerStyle={styles.body}
						keyboardShouldPersistTaps="handled"
					>
						<CatalogThumb
							imagePath={detail?.image}
							bannerHeight={180}
							rounded={radius.md}
						/>
						{loading ? <Text style={styles.meta}>…</Text> : null}
						{!loading && steps.length === 0 ? (
							<Text style={styles.meta}>{tt('exercise.noSteps')}</Text>
						) : null}
						{steps.map((step, i) => (
							<Text key={i} style={styles.step}>
								{i + 1}. {step}
							</Text>
						))}
					</ScrollView>
					<PrimaryButton label={tt('common.close')} onPress={onClose} />
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	wrap: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'transparent'
	},
	backdrop: {
		...StyleSheet.absoluteFill,
		backgroundColor: 'rgba(0,0,0,0.55)'
	},
	sheet: {
		maxHeight: '78%',
		backgroundColor: colors.panel,
		borderTopLeftRadius: radius.xl,
		borderTopRightRadius: radius.xl,
		paddingHorizontal: space.lg,
		paddingTop: space.md,
		gap: space.sm,
		borderTopWidth: 1,
		borderColor: colors.border
	},
	handle: {
		alignSelf: 'center',
		width: 40,
		height: 4,
		borderRadius: 999,
		backgroundColor: colors.border,
		marginBottom: 4
	},
	title: { color: colors.text, fontSize: 20, fontWeight: '800' },
	meta: { color: colors.muted, fontSize: 13 },
	scroll: { flexGrow: 0 },
	body: { gap: space.sm, paddingBottom: space.sm },
	step: {
		color: colors.text,
		fontSize: 15,
		lineHeight: 22,
		minHeight: touchMin / 2
	}
});
