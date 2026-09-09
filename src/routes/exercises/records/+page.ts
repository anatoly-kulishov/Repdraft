import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => ({
	...data,
	recordsCountPeek: data.recordsCountPeek ?? null
});
