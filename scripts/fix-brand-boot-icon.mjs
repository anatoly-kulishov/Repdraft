/**
 * Render favicon.svg + favicon.ico from brand app-icon-master (full RP monogram).
 *   node scripts/fix-brand-boot-icon.mjs
 *
 * PNG masters: use npm run icons:pwa (render-pwa-icons.mjs).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = join(root, 'static');
const brandDir = join(root, 'src/lib/assets/brand');

const masterSvg = readFileSync(join(brandDir, 'app-icon-master.svg'));

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

async function renderFaviconPng(size) {
	return sharp(masterSvg)
		.resize(size, size, { kernel: sharp.kernel.lanczos3 })
		.flatten({ background: '#C8FF00' })
		.png({ compressionLevel: 9, force: true })
		.toBuffer();
}

writeFileSync(join(staticDir, 'icon.svg'), masterSvg);

const faviconSizes = [16, 32, 48];
const faviconPngs = await Promise.all(
	faviconSizes.map(async (size) => ({ size, png: await renderFaviconPng(size) }))
);
writeFileSync(join(staticDir, 'favicon.ico'), buildIcoFromPngs(faviconPngs));

console.log('rendered static/icon.svg + favicon.ico from app-icon-master.svg');
