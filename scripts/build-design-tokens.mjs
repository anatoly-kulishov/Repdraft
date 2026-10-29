#!/usr/bin/env node
/**
 * Generate web CSS core vars from src/lib/design/tokens.ts values.
 * Run: node scripts/build-design-tokens.mjs
 * Check: npm run check:tokens
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tokensPath = path.join(root, 'src/lib/design/tokens.ts');
const outPath =
	process.env.REPDRAFT_TOKENS_OUT ||
	path.join(root, 'src/lib/styles/blocks/tokens.core.generated.css');

const source = readFileSync(tokensPath, 'utf8');

function parseObject(name) {
	const marker = `export const ${name}`;
	const start = source.indexOf(marker);
	if (start < 0) throw new Error(`Missing ${name}`);
	let i = source.indexOf('{', start);
	let depth = 0;
	const begin = i;
	for (; i < source.length; i++) {
		if (source[i] === '{') depth++;
		else if (source[i] === '}') {
			depth--;
			if (depth === 0) {
				i++;
				break;
			}
		}
	}
	const block = source.slice(begin, i);
	const dict = {};
	const re = /(\w+):\s*'([^']+)'/g;
	let m;
	while ((m = re.exec(block)) !== null) dict[m[1]] = m[2];
	return dict;
}

function parseConstNumber(name) {
	const m = source.match(new RegExp(`export const ${name} = (\\d+)`));
	if (!m) throw new Error(`Missing ${name}`);
	return Number(m[1]);
}

const dark = parseObject('darkColors');
const light = parseObject('lightColors');
const radiusRem = parseObject('radiusRem');
const touchMin = parseConstNumber('touchMin');

/** @param {Record<string, string>} c @param {'dark' | 'light'} mode */
function colorBlock(c, mode) {
	// Dark elevated matches muted plate; light elevated matches white surface.
	const elevated = mode === 'light' ? c.panel : c.panelRaised;
	return [
		`\t--color-bg: ${c.bg};`,
		`\t--color-surface: ${c.panel};`,
		`\t--color-surface-muted: ${c.panelRaised};`,
		`\t--color-surface-elevated: ${elevated};`,
		`\t--color-ink: ${c.text};`,
		`\t--color-muted: ${c.muted};`,
		`\t--color-placeholder: ${c.muted};`,
		`\t--color-accent: ${c.accent};`,
		`\t--color-accent-fill: ${c.accentFill};`,
		`\t--color-accent-ink: ${c.accentInk};`,
		`\t--color-accent-muted: ${c.accentDim};`,
		`\t--color-accent-text: ${c.accentText};`,
		`\t--color-danger: ${c.danger};`,
		`\t--color-danger-bg: ${c.dangerBg};`,
		`\t--color-success: ${c.success};`,
		`\t--color-success-bg: ${c.successBg};`,
		`\t--color-border: ${c.border};`,
		`\t--color-xp: ${c.xp};`,
		`\t--color-muscle: ${c.muscle};`
	].join('\n');
}

const css = `/* AUTO-GENERATED from src/lib/design/tokens.ts — do not edit by hand.
 * Run: npm run build:tokens
 */
:root {
${colorBlock(dark, 'dark')}
\t--radius-panel: ${radiusRem.panel};
\t--radius-control: ${radiusRem.control};
\t--radius-button: ${radiusRem.button};
\t--radius-lg: ${radiusRem.lg};
\t--control-height: ${touchMin / 16}rem;
\t--control-min-width: ${touchMin / 16}rem;
}

html[data-theme='light'] {
${colorBlock(light, 'light')}
}
`;

writeFileSync(outPath, css);
console.log('wrote', path.relative(root, outPath));
