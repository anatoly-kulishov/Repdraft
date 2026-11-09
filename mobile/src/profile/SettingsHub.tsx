import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
	BarChart3,
	CloudDownload,
	Crown,
	Home,
	Languages,
	Shield,
	Smartphone,
	Users
} from 'lucide-react-native';
import { useLocale } from '../state/locale';
import { useAppColors } from '../state/theme';
import { fontFamily, space, touchMin, type ColorPalette } from '../theme';
import { useMemo } from 'react';

type Props = {
	signedIn: boolean;
	showPro?: boolean;
	showCoach?: boolean;
	showWorkout?: boolean;
};

export function SettingsHub({
	signedIn,
	showPro = true,
	showCoach = false,
	showWorkout = true
}: Props) {
	const router = useRouter();
	const { tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);

	const rows: {
		key: string;
		label: string;
		hint: string;
		href: string;
		icon: typeof Home;
		show: boolean;
	}[] = [
		{
			key: 'workout',
			label: tt('settings.sessionTitle'),
			hint: tt('settings.section.workoutHint'),
			href: '/settings/workout',
			icon: Smartphone,
			show: showWorkout
		},
		{
			key: 'training',
			label: tt('settings.trainingProfileTitle'),
			hint: tt('settings.section.trainingHint'),
			href: '/settings/training',
			icon: Home,
			show: true
		},
		{
			key: 'interface',
			label: tt('settings.interfaceTitle'),
			hint: tt('settings.section.interfaceHint'),
			href: '/settings/interface',
			icon: Languages,
			show: true
		},
		{
			key: 'progress',
			label: tt('progress.sectionTitle'),
			hint: tt('settings.section.progressHint'),
			href: '/settings/progress',
			icon: BarChart3,
			show: true
		},
		{
			key: 'pro',
			label: tt('billing.title'),
			hint: tt('settings.section.proHint'),
			href: '/settings/pro',
			icon: Crown,
			show: showPro && signedIn
		},
		{
			key: 'coach',
			label: tt('profile.clients'),
			hint: tt('settings.section.coachHint'),
			href: '/settings/coach',
			icon: Users,
			show: showCoach && signedIn
		},
		{
			key: 'data',
			label: tt('settings.exportTitle'),
			hint: tt('settings.section.dataHint'),
			href: '/settings/data',
			icon: CloudDownload,
			show: true
		},
		{
			key: 'account',
			label: tt('settings.accountTitle'),
			hint: tt('settings.section.accountHint'),
			href: '/settings/account',
			icon: Shield,
			show: signedIn
		}
	];

	return (
		<View style={styles.panel}>
			<Text style={styles.title}>{tt('settings.title')}</Text>
			<Text style={styles.hint}>{tt('settings.hubLead')}</Text>
			{rows
				.filter((row) => row.show)
				.map((row) => {
					const Icon = row.icon;
					return (
						<Pressable
							key={row.key}
							style={styles.row}
							accessibilityRole="button"
							onPress={() => router.push(row.href as never)}
						>
							<Icon color={colors.text} size={18} strokeWidth={2} />
							<View style={styles.rowBody}>
								<Text style={styles.rowText}>{row.label}</Text>
								<Text style={styles.rowHint} numberOfLines={1}>
									{row.hint}
								</Text>
							</View>
							<Text style={styles.chevron}>→</Text>
						</Pressable>
					);
				})}
		</View>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		panel: {
			borderWidth: 1,
			borderColor: colors.border,
			borderRadius: 16,
			padding: space.md,
			gap: 4,
			backgroundColor: colors.panel
		},
		title: {
			fontFamily: fontFamily.bold,
			fontSize: 16,
			color: colors.text,
			marginBottom: 2
		},
		hint: {
			fontFamily: fontFamily.regular,
			fontSize: 13,
			color: colors.muted,
			marginBottom: 8
		},
		row: {
			minHeight: touchMin,
			flexDirection: 'row',
			alignItems: 'center',
			gap: 10,
			paddingVertical: 8
		},
		rowBody: { flex: 1, minWidth: 0 },
		rowText: { fontFamily: fontFamily.medium, fontSize: 15, color: colors.text },
		rowHint: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
		chevron: { fontFamily: fontFamily.medium, color: colors.muted, fontSize: 16 }
	});
}
