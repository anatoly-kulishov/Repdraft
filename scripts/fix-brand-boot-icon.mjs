/**
 * Render canonical Repdraft app icons from SVG (no export fringe / dark 1px strip).
 *   node scripts/fix-brand-boot-icon.mjs
 *
 * PNG/ICO: required for iOS home screen + manifest (Safari skips SVG icons).
 * SVG: served for in-tab favicon + any vector use (crisp at all DPR).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = join(root, 'static');

/** Matches in-app mark; white stroke on violet gradient plate. */
export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8B5CF6"/>
      <stop offset="1" stop-color="#6366F1"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="114" ry="114" fill="url(#g)"/>
  <path
    d="M148 112V392M148 112H286C347 112 380 148 380 198C380 248 347 280 286 280H148M218 280L350 408"
    fill="none"
    stroke="#FFFFFF"
    stroke-width="34"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>`;

/** Master raster for downscale — sharper small PNGs than direct SVG→16px. */
const MASTER_PX = 1024;
const PNG_OPTS = { compressionLevel: 9, effort: 10, adaptiveFiltering: true };

let masterRaster = null;

async function getMasterRaster() {
	if (masterRaster) return masterRaster;
	masterRaster = await sharp(Buffer.from(ICON_SVG), { density: 288 })
		.resize(MASTER_PX, MASTER_PX, { kernel: sharp.kernel.lanczos3 })
		.png(PNG_OPTS)
		.toBuffer();
	return masterRaster;
}

async function renderPng(size, outputPath) {
	const master = await getMasterRaster();
	await sharp(master)
		.resize(size, size, { kernel: sharp.kernel.lanczos3 })
		.png(PNG_OPTS)
		.toFile(outputPath);
}

async function renderPngBuffer(size) {
	const master = await getMasterRaster();
	return sharp(master)
		.resize(size, size, { kernel: sharp.kernel.lanczos3 })
		.png(PNG_OPTS)
		.toBuffer();
}

/** Vista+ ICO container with embedded PNG payloads (no extra deps). */
function buildIcoFromPngs(pngBySize) {
	const count = pngBySize.length;
	const headerSize = 6;
	const dirEntrySize = 16;
	let offset = headerSize + count * dirEntrySize;

	const header = Buffer.alloc(headerSize);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(count, 4);

	const entries = [];
	const payloads = [];

	for (const { size, png } of pngBySize) {
		const entry = Buffer.alloc(dirEntrySize);
		entry.writeUInt8(size >= 256 ? 0 : size, 0);
		entry.writeUInt8(size >= 256 ? 0 : size, 1);
		entry.writeUInt16LE(1, 4);
		entry.writeUInt16LE(32, 6);
		entry.writeUInt32LE(png.length, 8);
		entry.writeUInt32LE(offset, 12);
		offset += png.length;
		entries.push(entry);
		payloads.push(png);
	}

	return Buffer.concat([header, ...entries, ...payloads]);
}

writeFileSync(join(staticDir, 'icon.svg'), `${ICON_SVG.trim()}\n`);

await renderPng(192, join(staticDir, 'icon-192-v2.png'));
await renderPng(192, join(staticDir, 'icon-boot.png'));
await renderPng(512, join(staticDir, 'icon-512-v2.png'));
await renderPng(180, join(staticDir, 'apple-touch-icon-v2.png'));
await renderPng(180, join(staticDir, 'apple-touch-icon-precomposed-v2.png'));
await renderPng(512, join(staticDir, 'icon-maskable-512-v2.png'));

const faviconSizes = [16, 32, 48];
const faviconPngs = await Promise.all(
	faviconSizes.map(async (size) => ({ size, png: await renderPngBuffer(size) }))
);
writeFileSync(join(staticDir, 'favicon.ico'), buildIcoFromPngs(faviconPngs));

console.log('rendered static/icon.svg + *-v2.png + favicon.ico from SVG master');
