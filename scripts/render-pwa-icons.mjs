/**
 * Rasterize Repdraft PWA icons without native deps (rectangle PNG writer).
 * Run: node scripts/render-pwa-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const staticDir = join(here, '..', 'static');

const TEAL = [0x0f, 0x76, 0x6e, 0xff];
const INK = [0xf7, 0xf9, 0xfb, 0xff];

function crcTable() {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c;
	}
	return table;
}
const CRC = crcTable();

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const typeBuf = Buffer.from(type);
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const crcBuf = Buffer.alloc(4);
	crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
	return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(size, rgba) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8;
	ihdr[9] = 6; // RGBA
	const stride = size * 4;
	const raw = Buffer.alloc((stride + 1) * size);
	for (let y = 0; y < size; y++) {
		const row = y * (stride + 1);
		raw[row] = 0;
		rgba.copy(raw, row + 1, y * stride, y * stride + stride);
	}
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0))
	]);
}

function fill(rgba, size, color) {
	for (let i = 0; i < size * size; i++) {
		const o = i * 4;
		rgba[o] = color[0];
		rgba[o + 1] = color[1];
		rgba[o + 2] = color[2];
		rgba[o + 3] = color[3];
	}
}

function fillRoundRect(rgba, size, x0, y0, w, h, r, color) {
	const x1 = x0 + w;
	const y1 = y0 + h;
	const rr = Math.min(r, w / 2, h / 2);
	for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
		for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
			if (x < 0 || y < 0 || x >= size || y >= size) continue;
			let inside = true;
			if (x < x0 + rr && y < y0 + rr) {
				const dx = x0 + rr - x;
				const dy = y0 + rr - y;
				inside = dx * dx + dy * dy <= rr * rr;
			} else if (x > x1 - rr && y < y0 + rr) {
				const dx = x - (x1 - rr);
				const dy = y0 + rr - y;
				inside = dx * dx + dy * dy <= rr * rr;
			} else if (x < x0 + rr && y > y1 - rr) {
				const dx = x0 + rr - x;
				const dy = y - (y1 - rr);
				inside = dx * dx + dy * dy <= rr * rr;
			} else if (x > x1 - rr && y > y1 - rr) {
				const dx = x - (x1 - rr);
				const dy = y - (y1 - rr);
				inside = dx * dx + dy * dy <= rr * rr;
			}
			if (!inside) continue;
			const o = (y * size + x) * 4;
			rgba[o] = color[0];
			rgba[o + 1] = color[1];
			rgba[o + 2] = color[2];
			rgba[o + 3] = color[3];
		}
	}
}

/** Barbell in unit square [0,1], scaled into glyph box. */
function drawBarbell(rgba, size, padRatio) {
	fill(rgba, size, TEAL);
	const pad = size * padRatio;
	const box = size - pad * 2;
	const s = (u) => pad + u * box;
	const rect = (x, y, w, h, r) =>
		fillRoundRect(rgba, size, s(x), s(y), w * box, h * box, r * box, INK);

	// Coordinates match icon.svg viewBox 0..32, normalized.
	rect(9 / 32, 14.5 / 32, 14 / 32, 3 / 32, 1.5 / 32);
	rect(5 / 32, 10 / 32, 4.5 / 32, 12 / 32, 1.25 / 32);
	rect(3.5 / 32, 12 / 32, 2.5 / 32, 8 / 32, 1 / 32);
	rect(22.5 / 32, 10 / 32, 4.5 / 32, 12 / 32, 1.25 / 32);
	rect(26 / 32, 12 / 32, 2.5 / 32, 8 / 32, 1 / 32);
}

function writeIcon(name, size, padRatio) {
	const rgba = Buffer.alloc(size * size * 4);
	drawBarbell(rgba, size, padRatio);
	const out = join(staticDir, name);
	writeFileSync(out, encodePng(size, rgba));
	console.log('wrote', name, `${size}x${size}`, `pad=${padRatio}`);
}

// any icons: modest inset (~18%); maskable: larger safe zone (~22.5% each side ≈ 55% glyph)
writeIcon('icon-192.png', 192, 0.18);
writeIcon('icon-512.png', 512, 0.18);
writeIcon('apple-touch-icon.png', 180, 0.18);
writeIcon('icon-maskable-512.png', 512, 0.225);
