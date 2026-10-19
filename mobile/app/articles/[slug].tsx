import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo } from 'react';
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View
} from 'react-native';
import { loadArticles } from '../../src/articles/loadArticles';
import { ArticleBody } from '../../src/articles/ArticleBody';
import { useBottomChromePad } from '../../src/layout/safe';
import { useLocale } from '../../src/state/locale';
import { useAppColors } from '../../src/state/theme';
import { fontFamily, radius, space, touchMin, type ColorPalette } from '../../src/theme';

export default function ArticleDetailScreen() {
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const router = useRouter();
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const bottomPad = useBottomChromePad(space.lg);

	const article = useMemo(() => {
		const all = loadArticles();
		return all.find((a) => a.slug === slug && a.locale === locale) ?? all.find((a) => a.slug === slug);
	}, [slug, locale]);

	if (!article) {
		return (
			<View style={styles.center}>
				<Text style={styles.title}>{tt('articles.emptyTitle')}</Text>
				<Text style={styles.muted}>{tt('articles.emptyDesc')}</Text>
			</View>
		);
	}

	return (
		<ScrollView contentContainerStyle={[styles.root, { paddingBottom: bottomPad }]}>
			<Pressable
				style={({ pressed }) => [styles.back, pressed && styles.pressed]}
				onPress={() => router.back()}
				accessibilityRole="button"
			>
				<ChevronLeft size={20} color={colors.text} strokeWidth={2} />
				<Text style={styles.backLabel}>{tt('articles.backHub')}</Text>
			</Pressable>
			<Text style={styles.title}>{article.title}</Text>
			<Text style={styles.excerpt}>{article.excerpt}</Text>
			<View style={styles.card}>
				<ArticleBody markdown={article.bodyMd} />
			</View>
		</ScrollView>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: {
			padding: space.lg,
			gap: space.md,
			backgroundColor: colors.bg
		},
		center: {
			flex: 1,
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: colors.bg,
			padding: space.lg
		},
		back: {
			flexDirection: 'row',
			alignItems: 'center',
			minHeight: touchMin,
			gap: space.xs
		},
		pressed: { opacity: 0.85 },
		backLabel: {
			color: colors.text,
			fontSize: 16,
			fontWeight: '600',
			fontFamily: fontFamily.semibold
		},
		title: {
			color: colors.text,
			fontSize: 24,
			fontWeight: '800',
			fontFamily: fontFamily.extrabold
		},
		excerpt: {
			color: colors.muted,
			fontSize: 15,
			lineHeight: 22,
			fontFamily: fontFamily.regular
		},
		card: {
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.md
		},
		muted: {
			color: colors.muted,
			fontSize: 15,
			textAlign: 'center',
			fontFamily: fontFamily.regular
		}
	});
}
