/**
 * Legacy icon generator (old inline-SVG mark). Canonical app icons live in
 * Canonical icons: static/*-v2.png — do not run this unless regenerating legacy set.
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = join(root, 'static');

const GRADIENT = `
	<defs>
		<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#8B5CF6" />
			<stop offset="1" stop-color="#6366F1" />
		</linearGradient>
	</defs>`;

const MARK = `
	<path
		d="M148 112V392M148 112H286C347 112 380 148 380 198C380 248 347 280 286 280H148M218 196H320M218 280L350 408"
		fill="none"
		stroke="url(#g)"
		stroke-width="34"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>`;

/** Full-bleed square for apple-touch / any (OS applies mask). */
function anySvg({ bg, surface = bg, stroke = null }) {
	const border = stroke
		? `<rect width="512" height="512" rx="112" fill="${surface}" />
	<rect x="10" y="10" width="492" height="492" rx="104" fill="none" stroke="${stroke}" stroke-width="10" />`
		: `<rect width="512" height="512" rx="112" fill="${surface}" />`;
	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
	${GRADIENT}
	${border}
	${MARK}
</svg>`);
}

/** Maskable: slightly inset frame so adaptive cropping keeps the mark. */
function maskableSvg(bg, stroke) {
	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
	${GRADIENT}
	<rect width="512" height="512" fill="${bg}" />
	<rect x="28" y="28" width="456" height="456" rx="96" fill="${bg}" stroke="${stroke}" stroke-width="8" />
	<g transform="translate(256 264) scale(0.9) translate(-256 -260)">
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

const dark = { bg: '#11141D', stroke: '#2B3040' };
const light = { bg: '#F7F8FC', surface: '#FFFFFF', stroke: '#C7CEDB' };

await writePng(join(staticDir, 'apple-touch-icon.png'), anySvg(dark), 180, dark.bg);
await writePng(join(staticDir, 'apple-touch-icon-light.png'), anySvg(light), 180, light.bg);
copyFileSync(join(staticDir, 'apple-touch-icon.png'), join(staticDir, 'apple-touch-icon-precomposed.png'));
/* Cache-bust installers: manifest / app.html point at *-v2.png */
copyFileSync(join(staticDir, 'apple-touch-icon.png'), join(staticDir, 'apple-touch-icon-v2.png'));
copyFileSync(
	join(staticDir, 'apple-touch-icon-precomposed.png'),
	join(staticDir, 'apple-touch-icon-precomposed-v2.png')
);
console.log('wrote static/apple-touch-icon-precomposed.png (+ v2)');

await writePng(join(staticDir, 'icon-192.png'), anySvg(dark), 192, dark.bg);
await writePng(join(staticDir, 'icon-192-light.png'), anySvg(light), 192, light.bg);
await writePng(join(staticDir, 'icon-512.png'), anySvg(dark), 512, dark.bg);
await writePng(join(staticDir, 'icon-512-light.png'), anySvg(light), 512, light.bg);
await writePng(join(staticDir, 'icon-maskable-512.png'), maskableSvg(dark.bg, dark.stroke), 512, dark.bg);
await writePng(
	join(staticDir, 'icon-maskable-512-light.png'),
	maskableSvg(light.bg, light.stroke),
	512,
	light.bg
);
copyFileSync(join(staticDir, 'icon-192.png'), join(staticDir, 'icon-192-v2.png'));
copyFileSync(join(staticDir, 'icon-512.png'), join(staticDir, 'icon-512-v2.png'));
copyFileSync(join(staticDir, 'icon-maskable-512.png'), join(staticDir, 'icon-maskable-512-v2.png'));
console.log('wrote static/icon-*-v2.png');

writeFileSync(join(staticDir, 'icon-maskable.svg'), maskableSvg(dark.bg, dark.stroke).toString('utf8') + '\n');
writeFileSync(
	join(staticDir, 'icon-maskable-light.svg'),
	maskableSvg(light.bg, light.stroke).toString('utf8') + '\n'
);
console.log('wrote static/icon-maskable.svg');
console.log('wrote static/icon-maskable-light.svg');

const adaptive = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
	<style>
		.surface { fill: #11141D; }
		.frame { stroke: #2B3040; }
		@media (prefers-color-scheme: light) {
			.surface { fill: #FFFFFF; }
			.frame { stroke: #C7CEDB; }
		}
	</style>
	${GRADIENT}
	<rect class="surface" width="512" height="512" rx="112" />
	<rect class="frame" x="10" y="10" width="492" height="492" rx="104" fill="none" stroke-width="10" />
	${MARK}
</svg>
`;
writeFileSync(join(staticDir, 'icon-adaptive.svg'), adaptive);
console.log('wrote static/icon-adaptive.svg');

const fav = readFileSync(join(staticDir, 'icon.svg'), 'utf8');
if (!fav.includes('#6366F1') || !fav.includes('#11141D')) {
	console.warn('warning: static/icon.svg does not look like current brand colors');
}
