/** Loose CORS for public RN clients hitting /api/* (catalog technique, AI plan). */
export const PUBLIC_API_CORS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export function corsJson(data: unknown, init?: { status?: number }): Response {
	return new Response(JSON.stringify(data), {
		status: init?.status ?? 200,
		headers: {
			'Content-Type': 'application/json',
			...PUBLIC_API_CORS
		}
	});
}

export function corsPreflight(): Response {
	return new Response(null, { status: 204, headers: { ...PUBLIC_API_CORS } });
}
