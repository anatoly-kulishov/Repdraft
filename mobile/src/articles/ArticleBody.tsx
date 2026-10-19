import { useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { articleMediaUrl } from '../catalog/mediaUrl';
import { useAppColors } from '../state/theme';
import { fontFamily, radius, space, type ColorPalette } from '../theme';

type InlinePart =
	| { type: 'text'; value: string }
	| { type: 'strong'; value: string }
	| { type: 'link'; label: string; href: string };

type Block =
	| { type: 'h2'; parts: InlinePart[] }
	| { type: 'p'; parts: InlinePart[] }
	| { type: 'ul'; items: InlinePart[][] }
	| { type: 'ol'; items: InlinePart[][] }
	| { type: 'img'; alt: string; src: string };

const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const ORDERED_ITEM = /^(\d+)\.\s+(.*)$/;
const INLINE_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;
const STRONG = /\*\*([^*]+)\*\*/g;

function parseInline(text: string): InlinePart[] {
	const parts: InlinePart[] = [];
	let cursor = 0;
	const combined = text
		.replace(INLINE_LINK, '\0LINK\0$1\0$2\0LINK\0')
		.replace(STRONG, '\0STRONG\0$1\0STRONG\0');
	const tokens = combined.split('\0');
	let mode: 'text' | 'link-label' | 'link-href' | 'strong' = 'text';
	let linkLabel = '';
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (token === 'LINK') {
			mode = 'link-label';
			continue;
		}
		if (token === 'STRONG') {
			mode = mode === 'strong' ? 'text' : 'strong';
			continue;
		}
		if (mode === 'link-label') {
			linkLabel = token;
			mode = 'link-href';
			continue;
		}
		if (mode === 'link-href') {
			parts.push({ type: 'link', label: linkLabel, href: token });
			linkLabel = '';
			mode = 'text';
			continue;
		}
		if (token) {
			parts.push({ type: mode === 'strong' ? 'strong' : 'text', value: token });
		}
	}
	if (parts.length === 0 && text) parts.push({ type: 'text', value: text });
	return parts;
}

export function parseArticleBody(markdown: string): Block[] {
	const lines = markdown.replace(/\r\n/g, '\n').split('\n');
	const blocks: Block[] = [];
	let listType: 'ul' | 'ol' | null = null;
	let listItems: InlinePart[][] = [];

	const flushList = () => {
		if (listItems.length && listType) {
			blocks.push({ type: listType, items: listItems });
		}
		listItems = [];
		listType = null;
	};

	for (const raw of lines) {
		const line = raw.trim();
		if (!line) {
			flushList();
			continue;
		}
		if (line.startsWith('## ')) {
			flushList();
			blocks.push({ type: 'h2', parts: parseInline(line.slice(3)) });
			continue;
		}
		const image = IMAGE_LINE.exec(line);
		if (image) {
			flushList();
			blocks.push({ type: 'img', alt: image[1] ?? '', src: image[2] ?? '' });
			continue;
		}
		if (line.startsWith('- ')) {
			listType = 'ul';
			listItems.push(parseInline(line.slice(2)));
			continue;
		}
		const ordered = ORDERED_ITEM.exec(line);
		if (ordered) {
			listType = 'ol';
			listItems.push(parseInline(ordered[2] ?? ''));
			continue;
		}
		flushList();
		blocks.push({ type: 'p', parts: parseInline(line) });
	}
	flushList();
	return blocks;
}

type Props = {
	markdown: string;
};

export function ArticleBody({ markdown }: Props) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const blocks = useMemo(() => parseArticleBody(markdown), [markdown]);

	return (
		<View style={styles.root}>
			{blocks.map((block, i) => {
				if (block.type === 'img') {
					return <ArticleImage key={i} src={block.src} alt={block.alt} />;
				}
				if (block.type === 'h2') {
					return (
						<Text key={i} style={styles.h2}>
							{renderParts(block.parts, styles)}
						</Text>
					);
				}
				if (block.type === 'p') {
					return (
						<Text key={i} style={styles.p}>
							{renderParts(block.parts, styles)}
						</Text>
					);
				}
				return (
					<View key={i} style={styles.list}>
						{block.items.map((item, idx) => (
							<View key={idx} style={styles.listItem}>
								<Text style={[styles.p, styles.listBullet]}>
									{block.type === 'ol' ? `${idx + 1}.` : '•'}
								</Text>
								<Text style={styles.p}>{renderParts(item, styles)}</Text>
							</View>
						))}
					</View>
				);
			})}
		</View>
	);
}

function ArticleImage({ src, alt }: { src: string; alt: string }) {
	const colors = useAppColors();
	const styles = useMemo(() => makeStyles(colors), [colors]);
	const uri = articleMediaUrl(src);
	const [failed, setFailed] = useState(false);
	if (!uri || failed) {
		return (
			<View style={styles.imgPlaceholder}>
				<Text style={styles.muted}>{alt || '[image]'}</Text>
			</View>
		);
	}
	return (
		<Image
			source={{ uri }}
			style={styles.img}
			resizeMode="cover"
			accessibilityLabel={alt}
			onError={() => setFailed(true)}
		/>
	);
}

function renderParts(
	parts: InlinePart[],
	styles: ReturnType<typeof makeStyles>
): React.ReactNode[] {
	return parts.map((part, i) => {
		if (part.type === 'strong') {
			return (
				<Text key={i} style={styles.strong}>
					{part.value}
				</Text>
			);
		}
		if (part.type === 'link') {
			return (
				<Pressable key={i} onPress={() => Linking.openURL(part.href)}>
					<Text style={styles.link}>{part.label}</Text>
				</Pressable>
			);
		}
		return (
			<Text key={i} style={styles.p}>
				{part.value}
			</Text>
		);
	});
}

function makeStyles(colors: ColorPalette) {
	return StyleSheet.create({
		root: { gap: space.sm },
		h2: {
			color: colors.text,
			fontSize: 18,
			fontWeight: '700',
			marginTop: space.sm,
			fontFamily: fontFamily.bold
		},
		p: { color: colors.text, fontSize: 15, lineHeight: 22, fontFamily: fontFamily.regular },
		muted: { color: colors.muted, fontSize: 13, fontFamily: fontFamily.regular },
		strong: { color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '700', fontFamily: fontFamily.bold },
		link: { color: colors.accentLink, fontSize: 15, lineHeight: 22, fontFamily: fontFamily.regular },
		list: { gap: 4 },
		listItem: { flexDirection: 'row', gap: 8, paddingRight: space.lg },
		listBullet: { width: 24 },
		img: {
			width: '100%',
			height: 160,
			borderRadius: radius.md
		},
		imgPlaceholder: {
			height: 160,
			borderRadius: radius.md,
			backgroundColor: colors.panelRaised,
			alignItems: 'center',
			justifyContent: 'center',
			borderWidth: 1,
			borderColor: colors.border
		}
	});
}
