import { resolveRequestLocale } from '$lib/i18n/locale';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ cookies, request }) => {
	const seoLocale = resolveRequestLocale(
		cookies.get('repdraft.locale'),
		request.headers.get('accept-language')
	);
	return { seoLocale };
};
