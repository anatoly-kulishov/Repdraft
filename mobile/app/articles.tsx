import { useRouter } from 'expo-router';
import {
	BookOpen,
	ClipboardList,
	Dumbbell,
	Flame,
	History,
	Library,
	Play,
	Search,
	Sparkles,
	Timer,
	TrendingUp,
	Upload,
	Users
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View
} from 'react-native';
import type { Article, ArticleCoverIcon } from '@repdraft/domain/articles';
import {
	filterArticles,
	loadArticles,
	sortArticlesForHub
} from '../src/articles/loadArticles';
import { useBottomChromePad } from '../src/layout/safe';
import { useLocale } from '../src/state/locale';
import { useAppColors } from '../src/state/theme';
import { fontFamily, radius, space, touchMin, type, type ColorPalette } from '../src/theme';

const ICON_MAP: Record<ArticleCoverIcon, React.ElementType> = {
	'book-open': BookOpen,
	timer: Timer,
	dumbbell: Dumbbell,
	play: Play,
	'clipboard-list': ClipboardList,
	library: Library,
	flame: Flame,
	history: History,
	sparkles: Sparkles,
	users: Users,
	chart: TrendingUp,
	upload: Upload
};

const TONE_COLORS: Record<string, { bg: string; text: string }> = {
	lime: { bg: '#84cc1640', text: '#a3e635' },
	purple: { bg: '#8b5cf640', text: '#c4b5fd' },
	teal: { bg: '#14b8a640', text: '#5eead4' },
	amber: { bg: '#f59e0b40', text: '#fcd34d' },
	rose: { bg: '#f43f5e40', text: '#fda4af' }
};

export default function ArticlesScreen() {
	const { locale, tt } = useLocale();
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const router = useRouter();
	const bottomPad = useBottomChromePad(space.lg);
	const [query, setQuery] = useState('');

	const sections = useMemo(() => {
		const all = loadArticles();
		const filtered = filterArticles(all, query, locale);
		const sorted = sortArticlesForHub(filtered);
		const gettingStarted = sorted.filter((a) => a.tags.includes('getting-started'));
		const rest = sorted.filter((a) => !a.tags.includes('getting-started'));
		type Section =
			| { type: 'header'; title: string; key: string }
			| { type: 'item'; article: Article; key: string };
		const out: Section[] = [];
		if (gettingStarted.length) {
			out.push({ type: 'header', title: tt('articles.gettingStarted'), key: 'h-getting-started' });
			for (const a of gettingStarted) out.push({ type: 'item', article: a, key: a.slug });
		}
		if (rest.length) {
			out.push({ type: 'header', title: tt('articles.more'), key: 'h-more' });
			for (const a of rest) out.push({ type: 'item', article: a, key: a.slug });
		}
		return out;
	}, [query, locale, tt]);

	return (
		<View style={styles.root}>
			<Text style={styles.pageTitle}>{tt('articles.title')}</Text>
			<Text style={styles.lead}>{tt('articles.lead')}</Text>
			<View style={styles.searchWrap}>
				<Search size={18} color={colors.muted} />
				<TextInput
					style={styles.input}
					placeholder={tt('articles.search')}
					placeholderTextColor={colors.muted}
					value={query}
					onChangeText={setQuery}
					autoCapitalize="none"
					clearButtonMode="while-editing"
					accessibilityLabel={tt('articles.search')}
				/>
			</View>
			<FlatList
				data={sections}
				keyExtractor={(item) => item.key}
				contentContainerStyle={{ paddingBottom: bottomPad }}
				renderItem={({ item }) => {
					if (item.type === 'header') {
						return <Text style={styles.sectionTitle}>{item.title}</Text>;
					}
					return <ArticleRow article={item.article} onPress={() => router.push(`/articles/${item.article.slug}`)} />;
				}}
			/>
		</View>
	);
}

function ArticleRow({ article, onPress }: { article: Article; onPress: () => void }) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const Icon = ICON_MAP[article.coverIcon as ArticleCoverIcon] ?? BookOpen;
	const tone = TONE_COLORS[article.coverTone ?? 'lime'] ?? TONE_COLORS.lime;

	return (
		<Pressable
			style={({ pressed }) => [styles.row, pressed && styles.pressed]}
			onPress={onPress}
			accessibilityRole="button"
		>
			<View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
				<Icon size={22} color={tone.text} strokeWidth={2} />
			</View>
			<View style={styles.rowBody}>
				<Text style={styles.rowTitle} numberOfLines={1}>
					{article.title}
				</Text>
				<Text style={styles.rowExcerpt} numberOfLines={2}>
					{article.excerpt}
					</Text>
			</View>
		</Pressable>
	);
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: {
			flex: 1,
			backgroundColor: colors.bg,
			paddingHorizontal: space.lg,
			paddingTop: space.lg
		},
		pageTitle: {
			color: colors.text,
			fontSize: 24,
			fontWeight: '800',
			marginBottom: space.xs,
			fontFamily: fontFamily.extrabold
		},
		lead: {
			color: colors.muted,
			fontSize: 15,
			lineHeight: 22,
			marginBottom: space.md,
			fontFamily: fontFamily.regular
		},
		searchWrap: {
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			paddingHorizontal: space.md,
			marginBottom: space.md,
			minHeight: touchMin
		},
		input: {
			flex: 1,
			marginLeft: space.sm,
			color: colors.text,
			fontSize: 16,
			fontFamily: fontFamily.regular
		},
		sectionTitle: {
			color: colors.text,
			fontSize: 18,
			fontWeight: '700',
			marginTop: space.sm,
			marginBottom: space.sm,
			fontFamily: fontFamily.bold
		},
		row: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: space.md,
			backgroundColor: colors.panel,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			padding: space.md,
			marginBottom: space.sm,
			minHeight: touchMin
		},
		pressed: { opacity: 0.85 },
		iconWrap: {
			width: 44,
			height: 44,
			borderRadius: radius.md,
			alignItems: 'center',
			justifyContent: 'center'
		},
		rowBody: {
			flex: 1,
			gap: 2
		},
		rowTitle: {
			color: colors.text,
			fontSize: 16,
			fontWeight: '700',
			fontFamily: fontFamily.bold
		},
		rowExcerpt: {
			color: colors.muted,
			fontSize: 13,
			lineHeight: 18,
			fontFamily: fontFamily.regular
		}
	});
}
