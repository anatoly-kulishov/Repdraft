/** Works on http://LAN-IP too — crypto.randomUUID needs a secure context. */
export function newId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const CLOUD_UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Postgres uuid columns — excludes demo plan and non-secure `newId()` fallbacks. */
export function isCloudPersistableId(id: string): boolean {
	return CLOUD_UUID_RE.test(id);
}
