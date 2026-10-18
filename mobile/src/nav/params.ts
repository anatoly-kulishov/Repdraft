/** Expo Router params may be string | string[]. Always take the first value. */
export function routeParam(value: string | string[] | undefined): string | undefined {
	if (value == null) return undefined;
	return Array.isArray(value) ? value[0] : value;
}
