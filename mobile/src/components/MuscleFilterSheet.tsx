import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { labelTarget } from '@repdraft/domain/labels.ru';
import { BottomSheet } from './BottomSheet';
import { PrimaryButton } from './PrimaryButton';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { radius, space, touchMin, type, type ColorPalette } from '../theme';

type Props = {
	open: boolean;
	selected: string;
	targets: readonly string[];
	onSelect: (target: string) => void;
	onClear: () => void;
	onDismiss: () => void;
};

export function MuscleFilterSheet({ open, selected, targets, onSelect, onClear, onDismiss }: Props) {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const hasActive = selected !== '';

	function pick(target: string) {
		onSelect(target);
		onDismiss();
	}

	function clearAndClose() {
		onClear();
		onDismiss();
	}

	const options = [
		{ key: '', label: tt('workouts.historyFilterAll') },
		...targets.map((target) => ({ key: target, label: labelTarget(target, locale) }))
	];

	return (
		<BottomSheet
			open={open}
			onDismiss={onDismiss}
			actions={
				hasActive ? (
					<PrimaryButton variant="ghost" label={tt('workouts.historyClearFiltersAria')} onPress={clearAndClose} />
				) : null
			}
		>
			<Text style={styles.title}>{tt('workouts.muscleFilter')}</Text>
			<View style={styles.list}>
				{options.map((option) => {
					const active = selected === option.key;
					return (
						<Pressable
							key={option.key || 'all'}
							accessibilityRole="radio"
							accessibilityState={{ checked: active }}
							style={({ pressed }) => [styles.row, pressed && styles.pressed]}
							onPress={() => (option.key ? pick(option.key) : clearAndClose())}
						>
							<Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
							{active ? <Check color={colors.accent} size={20} strokeWidth={2.5} /> : null}
						</Pressable>
					);
				})}
			</View>
		</BottomSheet>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		title: {
			...type.body,
			color: colors.text,
			fontWeight: '800',
			fontSize: 18
		},
		list: { gap: space.xs },
		row: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			paddingHorizontal: space.md,
			borderRadius: radius.md,
			backgroundColor: colors.panelRaised
		},
		pressed: { opacity: 0.85 },
		label: {
			...type.body,
			color: colors.text,
			fontWeight: '600',
			flex: 1,
			paddingRight: space.sm
		},
		labelActive: { color: colors.accent }
	});
}
