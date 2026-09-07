/**
 * Rebuild PWA / favicon / brand mark rasters from the pulse master.
 *
 * Source: src/lib/assets/brand/app-icon-master-pulse.png (full-bleed 1600)
 * Output: static/*-v3.png, favicon.ico, brand-mark-pulse.png, mark-pulse.png,
 *         icon.svg, mark.svg, app-icon-master.svg
 *
 * Usage: npm run icons:pwa
 *
 * In-app BrandMark / boot splash must use the same MARK_INSET as icon.svg.
 */
import sharp from 'sharp';
import { copyFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = join(root, 'src/lib/assets/brand');
const MASTER = join(brandDir, 'app-icon-master-pulse.png');
const PURPLE = { r: 124, g: 58, b: 237 }; // #7c3aed

/** Shared SVG / BrandMark placement for mark-pulse.png (512 viewBox). Mark is pre-padded. */
const MARK_INSET = { x: 0, y: 0, width: 512, height: 512 };

/** Slight zoom so RP reads at home-screen / favicon sizes without looking cramped. */
const ANY_ZOOM = 1.12;

function pngsToIco(pngBuffers) {
	const count = pngBuffers.length;
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(count, 4);
	const entries = [];
	let offset = 6 + count * 16;
	for (const png of pngBuffers) {
		const entry = Buffer.alloc(16);
		const w = png.readUInt32BE(16);
		const h = png.readUInt32BE(20);
		entry.writeUInt8(w >= 256 ? 0 : w, 0);
		entry.writeUInt8(h >= 256 ? 0 : h, 1);
		entry.writeUInt16LE(1, 4);
		entry.writeUInt16LE(32, 6);
		entry.writeUInt32LE(png.length, 8);
		entry.writeUInt32LE(offset, 12);
		entries.push(entry);
		offset += png.length;
	}
	return Buffer.concat([header, ...entries, ...pngBuffers]);
}

/** Crop to center then scale up (zoom into the mark). */
async function zoomedSquare(input, size, zoom) {
	const meta = await sharp(input).metadata();
	const src = Math.min(meta.width ?? size, meta.height ?? size);
	const crop = Math.round(src / zoom);
	const left = Math.round((src - crop) / 2);
	const top = Math.round((src - crop) / 2);
	return sharp(input)
		.extract({ left, top, width: crop, height: crop })
		.resize(size, size)
		.png()
		.toBuffer();
}

async function anyIcon(fullBleed, size, out) {
	const zoomed = await zoomedSquare(fullBleed, size, ANY_ZOOM);
	/* Optical Y: italic forms sit slightly high in the mass; nudge down less than before. */
	const shift = Math.round(size * 0.004);
	await sharp({
		create: { width: size, height: size, channels: 3, background: PURPLE }
	})
		.composite([{ input: zoomed, top: shift, left: 0 }])
		.png()
		.toFile(out);
}

function svgPlate(markHref, { embedBase64 = false } = {}) {
	const { x, y, width, height } = MARK_INSET;
	const imageTag = embedBase64
		? `<image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${markHref}" xlink:href="data:image/png;base64,${markHref}"/>`
		: `<image href="${markHref}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`;
	const ns = embedBase64
		? 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'
		: 'xmlns="http://www.w3.org/2000/svg"';
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg ${ns} viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b5cf6"/>
      <stop offset="0.62" stop-color="#a78bfa"/>
      <stop offset="1" stop-color="#c4b5fd"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="114" fill="url(#bg)"/>
  ${imageTag}
</svg>
`;
}

const fullBleed = await sharp(MASTER).png().toBuffer();
const { data, info } = await sharp(fullBleed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

await anyIcon(fullBleed, 512, join(root, 'static/icon-512-v3.png'));
await anyIcon(fullBleed, 192, join(root, 'static/icon-192-v3.png'));
await anyIcon(fullBleed, 180, join(root, 'static/apple-touch-icon-v3.png'));
copyFileSync(
	join(root, 'static/apple-touch-icon-v3.png'),
	join(root, 'static/apple-touch-icon-precomposed-v3.png')
);

/* Maskable: keep ~10% safe zone; mild zoom so RP stays readable after OS crop. */
const pad = Math.round(512 * 0.1);
const innerSize = 512 - pad * 2;
const inner = await zoomedSquare(fullBleed, innerSize, 1.06);
const innerShift = Math.round(innerSize * 0.012);
await sharp({
	create: { width: 512, height: 512, channels: 3, background: PURPLE }
})
	.composite([{ input: inner, left: pad, top: pad + innerShift }])
	.png()
	.toFile(join(root, 'static/icon-maskable-512-v3.png'));

/* Extract white RP → tight bbox (ignore sparse edge noise) → pack into 512. */
const markRaw = Buffer.alloc(data.length);
const colHits = new Uint32Array(info.width);
const rowHits = new Uint32Array(info.height);
for (let i = 0; i < data.length; i += 4) {
	const r = data[i];
	const g = data[i + 1];
	const b = data[i + 2];
	const lum = (r + g + b) / 3;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const sat = max === 0 ? 0 : (max - min) / max;
	const isMark = lum > 235 && sat < 0.08 && Math.abs(r - g) < 12 && Math.abs(g - b) < 12;
	markRaw[i] = 255;
	markRaw[i + 1] = 255;
	markRaw[i + 2] = 255;
	markRaw[i + 3] = isMark ? 255 : 0;
	if (isMark) {
		const px = (i / 4) | 0;
		const x = px % info.width;
		const y = (px / info.width) | 0;
		colHits[x]++;
		rowHits[y]++;
	}
}

function span(hist, minHits) {
	let lo = 0;
	let hi = hist.length - 1;
	while (lo < hist.length && hist[lo] < minHits) lo++;
	while (hi > lo && hist[hi] < minHits) hi--;
	return [lo, hi];
}

const [rawMinX, rawMaxX] = span(colHits, 12);
const [rawMinY, rawMaxY] = span(rowHits, 12);
const padX = Math.max(2, Math.round((rawMaxX - rawMinX + 1) * 0.02));
const padY = Math.max(2, Math.round((rawMaxY - rawMinY + 1) * 0.02));
const minX = Math.max(0, rawMinX - padX);
const maxX = Math.min(info.width - 1, rawMaxX + padX);
const minY = Math.max(0, rawMinY - padY);
const maxY = Math.min(info.height - 1, rawMaxY + padY);
const bw = maxX - minX + 1;
const bh = maxY - minY + 1;
if (bw < 32 || bh < 32) {
	throw new Error(`generate-brand-icons: mark bbox too small (${bw}x${bh})`);
}

const markCrop = await sharp(markRaw, {
	raw: { width: info.width, height: info.height, channels: 4 }
})
	.extract({ left: minX, top: minY, width: bw, height: bh })
	.png()
	.toBuffer();

/* Pack wide RP into 512 with ~10% side pad; optical nudge for italic letterforms. */
const sidePad = Math.round(512 * 0.1);
const targetW = 512 - sidePad * 2;
const scale = targetW / bw;
const targetH = Math.round(bh * scale);
/* Italic RP reads left-heavy; mild right nudge. Keep vertical mathematically centered. */
const opticalX = Math.round(512 * 0.014);
const opticalY = 0;
const left = Math.round((512 - targetW) / 2) + opticalX;
const top = Math.round((512 - targetH) / 2) + opticalY;
const resizedMark = await sharp(markCrop).resize(targetW, targetH).png().toBuffer();
const mark512 = await sharp({
	create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
})
	.composite([{ input: resizedMark, left, top }])
	.png()
	.toBuffer();
writeFileSync(join(brandDir, 'mark-pulse.png'), mark512);
writeFileSync(join(root, 'static/brand-mark-pulse.png'), mark512);

const favPngs = [];
for (const s of [16, 32, 48]) {
	favPngs.push(await sharp(join(root, 'static/icon-192-v3.png')).resize(s, s).png().toBuffer());
}
writeFileSync(join(root, 'static/favicon.ico'), pngsToIco(favPngs));

const markB64 = mark512.toString('base64');
writeFileSync(join(root, 'static/icon.svg'), svgPlate(markB64, { embedBase64: true }));
writeFileSync(join(brandDir, 'mark.svg'), svgPlate('./mark-pulse.png'));
writeFileSync(join(brandDir, 'app-icon-master.svg'), svgPlate('./mark-pulse.png'));

/* Maskable SVG preview: keep safe-zone framing. */
const maskableSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b5cf6"/>
      <stop offset="0.62" stop-color="#a78bfa"/>
      <stop offset="1" stop-color="#c4b5fd"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#7c3aed"/>
  <rect x="51" y="51" width="410" height="410" rx="91" fill="url(#bg)"/>
  <image href="./mark-pulse.png" x="51" y="51" width="410" height="410" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;
writeFileSync(join(brandDir, 'app-icon-maskable.svg'), maskableSvg);

console.log('generate-brand-icons: ok', {
	MARK_INSET,
	ANY_ZOOM,
	markBBox: { minX, minY, maxX, maxY, bw, bh }
});
