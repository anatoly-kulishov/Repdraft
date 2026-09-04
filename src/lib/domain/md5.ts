/**
 * Minimal MD5 (hex) for Gravatar email hashes.
 * ponytail: image CDN still accepts MD5; SHA-256 would need async Web Crypto at every call site.
 */
export function md5Hex(message: string): string {
	const bytes = Array.from(new TextEncoder().encode(message));
	const bitLenLo = (bytes.length * 8) >>> 0;
	const bitLenHi = Math.floor(bytes.length / 0x20000000); // bytes*8 >>> 32

	bytes.push(0x80);
	while (bytes.length % 64 !== 56) bytes.push(0);
	for (let i = 0; i < 4; i++) bytes.push((bitLenLo >>> (i * 8)) & 0xff);
	for (let i = 0; i < 4; i++) bytes.push((bitLenHi >>> (i * 8)) & 0xff);

	let a = 0x67452301;
	let b = 0xefcdab89;
	let c = 0x98badcfe;
	let d = 0x10325476;

	const S = [
		7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
		14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15,
		21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
	];
	const K = new Int32Array(64);
	for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);

	for (let offset = 0; offset < bytes.length; offset += 64) {
		const M = new Int32Array(16);
		for (let i = 0; i < 16; i++) {
			const j = offset + i * 4;
			M[i] =
				bytes[j]! |
				(bytes[j + 1]! << 8) |
				(bytes[j + 2]! << 16) |
				(bytes[j + 3]! << 24);
		}

		let A = a;
		let B = b;
		let C = c;
		let D = d;

		for (let i = 0; i < 64; i++) {
			let F: number;
			let g: number;
			if (i < 16) {
				F = (B & C) | (~B & D);
				g = i;
			} else if (i < 32) {
				F = (D & B) | (~D & C);
				g = (5 * i + 1) % 16;
			} else if (i < 48) {
				F = B ^ C ^ D;
				g = (3 * i + 5) % 16;
			} else {
				F = C ^ (B | ~D);
				g = (7 * i) % 16;
			}
			const sum = (A + F + K[i]! + M[g]!) | 0;
			A = D;
			D = C;
			C = B;
			B = (B + rotl(sum, S[i]!)) | 0;
		}

		a = (a + A) | 0;
		b = (b + B) | 0;
		c = (c + C) | 0;
		d = (d + D) | 0;
	}

	return leHex(a) + leHex(b) + leHex(c) + leHex(d);
}

function rotl(x: number, n: number): number {
	return (x << n) | (x >>> (32 - n));
}

function leHex(n: number): string {
	let out = '';
	for (let i = 0; i < 4; i++) {
		out += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
	}
	return out;
}
