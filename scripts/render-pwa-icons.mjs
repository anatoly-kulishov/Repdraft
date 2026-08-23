/**
 * Render opaque PWA / apple-touch PNGs from brand SVG masters.
 * iOS zoom animation shows white behind transparent icon corners — flatten required.
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const staticDir = join(root, 'static');
const brandDir = join(root, 'src/lib/assets/brand');

/** Flatten color for rounded-rect masters (gradient top-left). */
const FLATTEN_BG = '#B2EE37';

const masterSvg = readFileSync(join(brandDir, 'app-icon-master.svg'));
const maskableSvg = readFileSync(join(brandDir, 'app-icon-maskable.svg'));

async function writeOpaquePng(path, svg, size) {
	const buf = await sharp(svg)
		.resize(size, size)
		.flatten({ background: FLATTEN_BG })
		.png({ compressionLevel: 9, force: true })
		.toBuffer();
	writeFileSync(path, buf);
	console.log(`wrote ${path.replace(root + '/', '')} (${buf.length} bytes)`);
	return buf;
}

async function assertOpaque(path) {
	const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const { width, height, channels } = info;
	let transparent = 0;
	for (let i = 3; i < data.length; i += channels) {
		if (data[i] < 255) transparent++;
	}
	const corners = [
		[0, 0],
		[width - 1, 0],
		[0, height - 1],
		[width - 1, height - 1]
	].map(([x, y]) => data[(y * width + x) * channels + 3]);
	if (transparent > 0 || corners.some((a) => a < 255)) {
		throw new Error(`${path}: still has transparency (px=${transparent}, corners=${corners})`);
	}
}

await writeOpaquePng(join(staticDir, 'apple-touch-icon-v2.png'), masterSvg, 180);
copyFileSync(
	join(staticDir, 'apple-touch-icon-v2.png'),
	join(staticDir, 'apple-touch-icon-precomposed-v2.png')
);

await writeOpaquePng(join(staticDir, 'icon-192-v2.png'), masterSvg, 192);
await writeOpaquePng(join(staticDir, 'icon-512-v2.png'), masterSvg, 512);
await writeOpaquePng(join(staticDir, 'icon-maskable-512-v2.png'), maskableSvg, 512);
await writeOpaquePng(join(staticDir, 'icon-boot.png'), masterSvg, 192);

for (const name of [
	'apple-touch-icon-v2.png',
	'icon-192-v2.png',
	'icon-512-v2.png',
	'icon-maskable-512-v2.png',
	'icon-boot.png'
]) {
	await assertOpaque(join(staticDir, name));
}

writeFileSync(join(staticDir, 'icon.svg'), masterSvg);

const faviconSizes = [16, 32, 48];
const faviconPngs = await Promise.all(
	faviconSizes.map(async (size) => ({
		size,
		png: await sharp(masterSvg)
			.resize(size, size, { kernel: sharp.kernel.lanczos3 })
			.flatten({ background: FLATTEN_BG })
			.png({ compressionLevel: 9, force: true })
			.toBuffer()
	}))
);

/** Vista+ ICO container with embedded PNG payloads. */
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

writeFileSync(join(staticDir, 'favicon.ico'), buildIcoFromPngs(faviconPngs));

console.log('rendered static/icon.svg + favicon.ico + *-v2.png from app-icon-master.svg');
