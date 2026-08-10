/**
 * Rasterize PWA icons from the current Repdraft mark (dark + light).
 * Usage: node scripts/render-pwa-icons.mjs
 *
 * iOS notes:
 * - Home screen needs opaque PNG via <link rel="apple-touch-icon"> (Safari ignores SVG).
 * - Keep a single apple-touch-icon without media= — Safari mishandles media variants.
 * - Manifest icons must be square PNG; put purpose "any" before "maskable".
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = join(root, 'static');

const MARK = `
	<path d="M9 12.5V26" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
	<path d="M9 6.75V10.25" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
	<path
		d="M9 7h11.25a5.35 5.35 0 0 1 0 10.7H9"
		stroke="#8B5CF6"
		stroke-width="2.65"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<path d="M13.35 17.85 20.85 25.5" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
	<path d="M11.25 13.35h7.1" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
`;

/** Full-bleed square for apple-touch / any (OS applies mask). */
function anySvg(size, { bg, stroke = null, scale = 10.4 }) {
	const border = stroke
		? `<rect width="${size}" height="${size}" fill="${bg}" />
	<rect x="${size * 0.02}" y="${size * 0.02}" width="${size * 0.96}" height="${size * 0.96}" fill="none" stroke="${stroke}" stroke-width="${Math.max(2, size / 90)}" />`
		: `<rect width="${size}" height="${size}" fill="${bg}" />`;
	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none">
	${border}
	<g transform="translate(${size / 2} ${size / 2}) scale(${(scale * size) / 512}) translate(-16 -16)">
		${MARK}
	</g>
</svg>`);
}

/** Maskable: slightly smaller mark so it survives adaptive cropping. */
function maskableSvg(size, bg) {
	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none">
	<rect width="${size}" height="${size}" fill="${bg}" />
	<g transform="translate(${size / 2} ${size / 2}) scale(${(9.6 * size) / 512}) translate(-16 -16)">
		${MARK}
	</g>
</svg>`);
}

async function writePng(path, svg, size, flattenBg) {
	const buf = await sharp(svg)
		.resize(size, size)
		.flatten({ background: flattenBg })
		.png({ compressionLevel: 9, force: true })
		.toBuffer();
	writeFileSync(path, buf);
	console.log(`wrote ${path.replace(root + '/', '')} (${buf.length} bytes)`);
}

const dark = { bg: '#0B0B0C' };
const light = { bg: '#F7F9FB', stroke: '#B8C4D4' };

await writePng(join(staticDir, 'apple-touch-icon.png'), anySvg(180, dark), 180, dark.bg);
await writePng(join(staticDir, 'apple-touch-icon-light.png'), anySvg(180, light), 180, light.bg);
// Same bytes — older iOS looks for -precomposed by convention.
copyFileSync(join(staticDir, 'apple-touch-icon.png'), join(staticDir, 'apple-touch-icon-precomposed.png'));
console.log('wrote static/apple-touch-icon-precomposed.png');

await writePng(join(staticDir, 'icon-192.png'), anySvg(192, dark), 192, dark.bg);
await writePng(join(staticDir, 'icon-192-light.png'), anySvg(192, light), 192, light.bg);
await writePng(join(staticDir, 'icon-512.png'), anySvg(512, dark), 512, dark.bg);
await writePng(join(staticDir, 'icon-512-light.png'), anySvg(512, light), 512, light.bg);
await writePng(join(staticDir, 'icon-maskable-512.png'), maskableSvg(512, dark.bg), 512, dark.bg);
await writePng(join(staticDir, 'icon-maskable-512-light.png'), maskableSvg(512, light.bg), 512, light.bg);

writeFileSync(join(staticDir, 'icon-maskable.svg'), maskableSvg(512, dark.bg).toString('utf8') + '\n');
writeFileSync(
	join(staticDir, 'icon-maskable-light.svg'),
	maskableSvg(512, light.bg).toString('utf8') + '\n'
);
console.log('wrote static/icon-maskable.svg');
console.log('wrote static/icon-maskable-light.svg');

// Adaptive SVG: follows phone OS color scheme (browser tab favicon only — not for iOS home screen).
const adaptive = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
	<style>
		.bg { fill: #0B0B0C; }
		.frame { stroke: transparent; }
		@media (prefers-color-scheme: light) {
			.bg { fill: #F7F9FB; }
			.frame { stroke: #B8C4D4; }
		}
	</style>
	<rect class="bg" width="32" height="32" rx="8" />
	<rect class="frame" x="0.5" y="0.5" width="31" height="31" rx="7.5" stroke-width="1" />
	<path d="M9 12.5V26" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
	<path d="M9 6.75V10.25" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
	<path
		d="M9 7h11.25a5.35 5.35 0 0 1 0 10.7H9"
		stroke="#8B5CF6"
		stroke-width="2.65"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<path d="M13.35 17.85 20.85 25.5" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
	<path d="M11.25 13.35h7.1" stroke="#8B5CF6" stroke-width="2.65" stroke-linecap="round" />
</svg>
`;
writeFileSync(join(staticDir, 'icon-adaptive.svg'), adaptive);
console.log('wrote static/icon-adaptive.svg');

const fav = readFileSync(join(staticDir, 'icon.svg'), 'utf8');
if (!fav.includes('#8B5CF6') || !fav.includes('#0B0B0C')) {
	console.warn('warning: static/icon.svg does not look like current brand colors');
}
