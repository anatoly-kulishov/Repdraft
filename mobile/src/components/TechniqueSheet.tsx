import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { labelBodyPart } from '@repdraft/domain/labels.ru';
import {
	fetchExerciseDetail,
	stepsForLocale,
	type ExerciseDetailPayload
} from '../catalog/fetchExerciseDetail';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, touchMin, type ColorPalette } from '../theme';
import { BottomSheet } from './BottomSheet';
import { CatalogThumb } from './CatalogThumb';
import { PrimaryButton } from './PrimaryButton';

type Props = {
	exerciseId: string | null;
	onClose: () => void;
};

export function TechniqueSheet({ exerciseId, onClose }: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
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
			: (detail?.name ?? tt('exercise.techniqueTitle'));

	return (
		<BottomSheet
			open={open}
			onDismiss={onClose}
			label={title}
			actions={<PrimaryButton label={tt('common.close')} onPress={onClose} />}
		>
			<Text style={styles.title} numberOfLines={2}>
				{title}
			</Text>
			{detail ? (
				<Text style={styles.meta} numberOfLines={2}>
					{labelBodyPart(detail.body_part, locale)} · {detail.equipment}
				</Text>
			) : null}
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.body}
				keyboardShouldPersistTaps="handled"
			>
				<CatalogThumb imagePath={detail?.image} bannerHeight={180} rounded={radius.md} />
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
		</BottomSheet>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
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
}
