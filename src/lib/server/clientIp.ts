/** Client address behind the RF VPS reverse proxy (Caddy sets X-Forwarded-For). */
export function clientIp(request: Request): string {
	const forwarded = request.headers.get('x-forwarded-for');
	if (forwarded) {
		const first = forwarded.split(',')[0]?.trim();
		if (first) return first.slice(0, 128);
	}
	const real = request.headers.get('x-real-ip')?.trim();
	if (real) return real.slice(0, 128);
	return 'unknown';
}
