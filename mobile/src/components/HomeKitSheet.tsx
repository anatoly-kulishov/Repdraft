import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import {
	HOME_KIT_OPTIONAL_GROUPS,
	type HomeKitOptionalId
} from '@repdraft/domain/homeKit';
import { BottomSheet } from './BottomSheet';
import { PrimaryButton } from './PrimaryButton';
import { useLocale } from '../state/locale';
import { getHomeKitSelection, setHomeKitSelection } from '../state/prefs';
import { useAppColors } from '../state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../theme';

type Props = {
	open: boolean;
	onDismiss: () => void;
	onSaved?: (groups: HomeKitOptionalId[]) => void;
};

export function HomeKitSheet({ open, onDismiss, onSaved }: Props) {
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const [draft, setDraft] = useState<HomeKitOptionalId[]>([]);

	useEffect(() => {
		if (!open) return;
		void getHomeKitSelection().then(setDraft);
	}, [open]);

	function toggle(id: HomeKitOptionalId) {
		setDraft((prev) =>
			prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
		);
	}

	async function save() {
		await setHomeKitSelection(draft);
		onSaved?.(draft);
		onDismiss();
	}

	return (
		<BottomSheet open={open} onDismiss={onDismiss} label={tt('homeKit.title')} maxHeight="82%">
			<Text style={styles.title}>{tt('homeKit.title')}</Text>
			<Text style={styles.hint}>{tt('homeKit.hint')}</Text>
			<View style={styles.list}>
				<View
					style={[styles.row, styles.rowLocked]}
					accessibilityState={{ disabled: true }}
					accessibilityLabel={tt('homeKit.bodyweightAlways')}
				>
					<Text style={[styles.rowText, styles.rowTextMuted]}>
						{tt('homeKit.group.bodyweight')}
					</Text>
					<Switch
						value
						disabled
						trackColor={{ false: colors.border, true: colors.accent }}
						thumbColor={colors.bg}
						accessibilityLabel={tt('homeKit.bodyweightAlways')}
					/>
				</View>
				{HOME_KIT_OPTIONAL_GROUPS.map((id) => (
					<Pressable
						key={id}
						style={styles.row}
						onPress={() => toggle(id)}
						accessibilityRole="checkbox"
						accessibilityState={{ checked: draft.includes(id) }}
					>
						<Text style={styles.rowText}>{tt(`homeKit.group.${id}`)}</Text>
						<Switch
							value={draft.includes(id)}
							onValueChange={() => toggle(id)}
							trackColor={{ false: colors.border, true: colors.accent }}
							thumbColor={colors.bg}
						/>
					</Pressable>
				))}
			</View>
			<PrimaryButton label={tt('homeKit.save')} onPress={() => void save()} />
		</BottomSheet>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		title: {
			fontFamily: fontFamily.semibold,
			fontSize: 18,
			color: colors.text,
			marginBottom: space.sm
		},
		hint: {
			fontFamily: fontFamily.regular,
			fontSize: 14,
			color: colors.muted,
			marginBottom: space.md
		},
		list: {
			marginBottom: space.sm
		},
		row: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: space.sm
		},
		rowLocked: {
			opacity: 0.72,
			marginBottom: 4,
			paddingBottom: 4,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: colors.border
		},
		rowText: {
			flex: 1,
			fontFamily: fontFamily.regular,
			fontSize: 16,
			lineHeight: 22,
			color: colors.text
		},
		rowTextMuted: {
			color: colors.muted
		}
	});
}
